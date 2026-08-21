import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp, normalizePhone, choiceLabel } from "@/lib/fonnte";
import { parsePollName } from "@/lib/weeklyChoicePoll";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_SYSTEM_PROMPT = `Kamu adalah admin virtual BM Masterclass, sekolah les Mandarin.
Jawab pesan WhatsApp dari murid/calon murid dengan ramah, singkat, dan jelas
dalam Bahasa Indonesia. Kalau pertanyaannya di luar konteks sekolah atau kamu
nggak yakin jawabannya, bilang akan diteruskan ke admin manusia, jangan
ngarang jawaban.`;

// Webhook Fonnte -- dipanggil Fonnte tiap ada pesan/vote masuk ke nomor WA
// sekolah. Set URL ini di dashboard Fonnte: Device > Edit > Webhook URL,
// dan pastikan "Auto Read" di-ON-in, kalau nggak webhook-nya ga kepanggil.
//
// Kalau FONNTE_WEBHOOK_SECRET di-set, URL yang didaftarin ke Fonnte harus
// pake query ?secret=... yang sama, biar orang lain ga bisa nembak endpoint
// ini sembarangan (misal pura-pura jadi Fonnte).
export async function POST(req: NextRequest) {
  const expectedSecret = process.env.FONNTE_WEBHOOK_SECRET;
  if (expectedSecret) {
    const secret = req.nextUrl.searchParams.get("secret");
    if (secret !== expectedSecret) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();

  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid payload" }, { status: 400 });
  }

  const senderRaw = payload.sender || payload.phone || "";
  const isGroupMessage = Boolean(payload.member); // Fonnte isi field "member" cuma buat pesan grup
  const pollname = String(payload.pollname || "").trim();
  const pollChoice = String(payload.choices || "").trim();
  const messageText = String(payload.message || payload.text || "").trim();

  if (!senderRaw) {
    return NextResponse.json({ success: true, message: "Diabaikan (data tidak lengkap)" });
  }
  const senderPhone = normalizePhone(senderRaw);

  // ===== 1. Vote poll Weekly Choice (poll WA asli, bukan balasan teks) =====
  if (pollname && pollChoice) {
    const parsed = parsePollName(pollname);
    if (parsed) {
      const result = await handleWeeklyChoiceVote(supabase, {
        senderPhone,
        className: parsed.className,
        weekStart: parsed.weekStart,
        pollChoice,
      });
      return NextResponse.json(result);
    }
    // pollname ga dikenalin (bukan poll Weekly Choice) -- diamin aja.
    return NextResponse.json({ success: true, message: "Poll tidak dikenali, diabaikan" });
  }

  // ===== 2. Pesan grup (bukan vote poll) -- JANGAN di-auto-reply AI. =====
  // Grup WA itu ruang komunikasi kelas antar Laoshi/murid, bot ga boleh
  // nyeplos jawab di situ. Cuma vote poll (di atas) yang diproses dari grup.
  if (isGroupMessage) {
    return NextResponse.json({ success: true, message: "Pesan grup, diabaikan" });
  }

  if (!messageText) {
    return NextResponse.json({ success: true, message: "Diabaikan (tidak ada pesan)" });
  }

  // ===== 3. Fallback lama: balasan teks manual buat Weekly Choice =====
  // (kalau-kalau ada yang balas ketik manual bukan tap poll)
  const { data: student } = await supabase
    .from("students")
    .select("id, name, class_id, class_name, phone")
    .eq("status", "ACTIVE")
    .ilike("phone", `%${senderPhone.slice(-10)}%`)
    .maybeSingle();

  if (student && student.class_name) {
    const { data: sameNameClasses } = await supabase
      .from("classes")
      .select("id, name, teacher_name")
      .eq("name", student.class_name)
      .eq("active", true);

    if (sameNameClasses && sameNameClasses.length > 1) {
      const matched = sameNameClasses.find((c) =>
        messageText.toUpperCase().includes(String(c.teacher_name).toUpperCase())
      );

      if (matched) {
        const weekStart = getMondayOfWeek();
        await supabase.from("weekly_choices").upsert(
          {
            student_id: student.id,
            class_group_name: student.class_name,
            chosen_class_id: matched.id,
            week_start: weekStart,
            confirmed: true,
            confirmed_at: new Date().toISOString(),
          },
          { onConflict: "student_id,class_group_name,week_start" }
        );

        await sendWhatsApp(
          senderPhone,
          `Terima kasih ${student.name}! Pilihan kamu buat kelas ${student.class_name} minggu ini sudah dikonfirmasi ikut Laoshi ${matched.teacher_name}. 🙏`
        );

        return NextResponse.json({ success: true, message: "Weekly choice dikonfirmasi (balasan teks)" });
      }
    }
  }

  // ===== 4. Bukan konfirmasi weekly choice -> jawab pakai AI + knowledge base =====
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, message: "AI belum dikonfigurasi" });
  }

  const { data: settings } = await supabase
    .from("app_settings")
    .select("ai_knowledge_base")
    .eq("id", 1)
    .maybeSingle();

  const knowledgeBase = (settings?.ai_knowledge_base || "").trim();

  const senderContext = student
    ? `Pengirim adalah murid terdaftar bernama ${student.name}, kelas ${student.class_name}.`
    : "Pengirim belum terdaftar sebagai murid (kemungkinan calon murid).";

  const systemPrompt = knowledgeBase
    ? `${DEFAULT_SYSTEM_PROMPT}\n\nBerikut info resmi sekolah yang HARUS kamu pakai buat jawab (harga paket, jadwal, kebijakan, FAQ, dll). Kalau pertanyaan ga kejawab dari info ini, bilang terus terang akan diteruskan ke admin manusia -- jangan ngarang:\n\n${knowledgeBase}`
    : DEFAULT_SYSTEM_PROMPT;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `${senderContext}\n\nPesan dari pengirim: "${messageText}"`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const reply = textBlock && "text" in textBlock ? textBlock.text : "Maaf, admin akan membalas segera.";

    await sendWhatsApp(senderPhone, reply);

    return NextResponse.json({ success: true, message: "Dibalas AI" });
  } catch (error) {
    console.error("Gagal proses AI reply:", error);
    return NextResponse.json({ success: false, message: "Gagal proses balasan" });
  }
}

function getMondayOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

async function handleWeeklyChoiceVote(
  supabase: ReturnType<typeof createAdminClient>,
  opts: { senderPhone: string; className: string; weekStart: string; pollChoice: string }
) {
  const { senderPhone, className, weekStart, pollChoice } = opts;

  const { data: student } = await supabase
    .from("students")
    .select("id, name, class_name")
    .eq("status", "ACTIVE")
    .eq("class_name", className)
    .ilike("phone", `%${senderPhone.slice(-10)}%`)
    .maybeSingle();

  if (!student) {
    return { success: true, message: "Vote dari nomor yang ga kekenalan, diabaikan" };
  }

  const { data: sameNameClasses } = await supabase
    .from("classes")
    .select("id, name, teacher_name, day_of_week, start_time")
    .eq("name", className)
    .eq("active", true);

  const matched = (sameNameClasses ?? []).find(
    (c) => choiceLabel(c.teacher_name, c.day_of_week, c.start_time) === pollChoice
  );

  if (!matched) {
    return { success: true, message: "Pilihan poll ga ke-match ke kelas manapun, diabaikan" };
  }

  await supabase.from("weekly_choices").upsert(
    {
      student_id: student.id,
      class_group_name: className,
      chosen_class_id: matched.id,
      week_start: weekStart,
      confirmed: true,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: "student_id,class_group_name,week_start" }
  );

  await sendWhatsApp(
    senderPhone,
    `Terima kasih ${student.name}! Pilihan kamu buat kelas ${className} minggu ini sudah dikonfirmasi ikut Laoshi ${matched.teacher_name}. 🙏`
  );

  return { success: true, message: "Weekly choice dikonfirmasi (poll)" };
}
