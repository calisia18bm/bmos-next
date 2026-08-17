import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp, normalizePhone } from "@/lib/fonnte";
import Anthropic from "@anthropic-ai/sdk";

function getMondayOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

const SYSTEM_PROMPT = `Kamu adalah admin virtual BM Masterclass, sekolah les Mandarin.
Jawab pesan WhatsApp dari murid/calon murid dengan ramah, singkat, dan jelas
dalam Bahasa Indonesia. Kalau pertanyaannya di luar konteks sekolah atau kamu
nggak yakin jawabannya, bilang akan diteruskan ke admin manusia, jangan
ngarang jawaban.`;

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid payload" }, { status: 400 });
  }

  const senderRaw = payload.sender || payload.phone || "";
  const messageText = String(payload.message || "").trim();

  if (!senderRaw || !messageText) {
    return NextResponse.json({ success: true, message: "Diabaikan (data tidak lengkap)" });
  }

  const senderPhone = normalizePhone(senderRaw);

  // ===== Cek dulu: apakah ini balasan konfirmasi Weekly Choice? =====
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

        return NextResponse.json({ success: true, message: "Weekly choice dikonfirmasi" });
      }
    }
  }

  // ===== Bukan konfirmasi weekly choice -> jawab pakai AI =====
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, message: "AI belum dikonfigurasi" });
  }

  const [{ count: studentCount }, { count: classCount }] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "ACTIVE"),
    supabase.from("classes").select("*", { count: "exact", head: true }).eq("active", true),
  ]);

  const senderContext = student
    ? `Pengirim adalah murid terdaftar bernama ${student.name}, kelas ${student.class_name}.`
    : "Pengirim belum terdaftar sebagai murid (kemungkinan calon murid).";

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `${senderContext}\nJumlah murid aktif saat ini: ${studentCount}. Jumlah kelas aktif: ${classCount}.\n\nPesan dari pengirim: "${messageText}"`,
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
