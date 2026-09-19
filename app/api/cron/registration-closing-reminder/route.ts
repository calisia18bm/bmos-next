import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp, normalizePhone } from "@/lib/fonnte";
import { recordNotificationFailure } from "@/lib/notifyFailure";
import { SITE_URL } from "@/lib/site";

// Cron harian (lihat vercel.json) -- H-1 sebelum pendaftaran kelas
// ditutup (registration_end besok), tapi kuotanya BELUM penuh, Laoshi
// pengajar kelas itu dikabarin lewat WhatsApp: mau diperpanjang
// enggak tanggal pendaftarannya? Kelas yang kuotanya udah penuh ga
// perlu diingetin (emang udah ga butuh Murid tambahan lagi).
//
// CATATAN: Laoshi enggak bisa ubah tanggal pendaftaran sendiri kalau
// kelasnya udah APPROVED (lihat updateClassCard di class-cards/
// actions.ts) -- jadi pesannya ngarahin buat kontak BM kalau mau
// diperpanjang.
export async function GET(req: NextRequest) {
  // Proteksi -- cuma Vercel Cron (atau orang yang tau CRON_SECRET) yang boleh panggil ini
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, teacher_id, teacher_name, capacity_max, registration_end")
    .eq("approval_status", "APPROVED")
    .eq("active", true)
    .eq("registration_end", tomorrowStr);

  if (!classes || classes.length === 0) {
    return NextResponse.json({
      success: true,
      message: "Enggak ada kelas yang pendaftarannya tutup besok.",
    });
  }

  let sentCount = 0;
  let skippedFullCount = 0;

  for (const cls of classes) {
    const { count } = await supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("class_id", cls.id)
      .eq("request_status", "APPROVED")
      .eq("status", "ACTIVE");

    if ((count ?? 0) >= cls.capacity_max) {
      skippedFullCount += 1;
      continue;
    }

    if (!cls.teacher_id) continue;

    const { data: teacher } = await supabase
      .from("teachers")
      .select("name, phone")
      .eq("id", cls.teacher_id)
      .maybeSingle();

    if (!teacher?.phone) {
      await recordNotificationFailure(
        `Laoshi ${teacher?.name || cls.teacher_name || "-"} belum punya nomor HP di data Teachers, jadi reminder "pendaftaran mau ditutup" buat kelas "${cls.name}" enggak bisa dikirim WA.`
      );
      continue;
    }

    const message = `⏰ Pendaftaran kelas "${cls.name}" kamu bakal ditutup besok, tapi kuotanya masih ${count ?? 0}/${cls.capacity_max}. Mau diperpanjang tanggal pendaftarannya? Kalau iya, kabarin BM ya.\n\nCek: ${SITE_URL}/class-cards`;

    try {
      const result = await sendWhatsApp(normalizePhone(teacher.phone), message);
      if (result.success) {
        sentCount += 1;
      } else {
        await recordNotificationFailure(
          `Gagal kirim reminder "pendaftaran mau ditutup" ke Laoshi ${teacher.name || "-"} (${teacher.phone}) buat kelas "${cls.name}". Alasan: ${result.reason || "tidak diketahui"}.`
        );
      }
    } catch (err) {
      await recordNotificationFailure(
        `Gagal kirim reminder "pendaftaran mau ditutup" ke Laoshi ${teacher.name || "-"} (${teacher.phone}) buat kelas "${cls.name}". Error: ${err instanceof Error ? err.message : String(err)}.`
      );
    }
  }

  return NextResponse.json({
    success: true,
    message: `Reminder dikirim ke ${sentCount} Laoshi (${skippedFullCount} kelas dilewatin karena udah penuh).`,
  });
}
