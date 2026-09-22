import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp, normalizePhone } from "@/lib/fonnte";
import { recordNotificationFailure } from "@/lib/notifyFailure";
import { broadcastToBm } from "@/lib/bmContacts";
import { SITE_URL } from "@/lib/site";

// Cron harian (lihat vercel.json) -- buat kelas billing bulanan
// (billing_type='MONTHLY') yang enrollment-nya udah lewat next_due_date
// tapi belum bayar lagi, Status Murid otomatis diubah ke "Jatuh Tempo"
// (kalau belum), terus Murid & SEMUA akun BM (Owner/Admin) dikabarin
// lewat WhatsApp. Murid yang udah "Jatuh Tempo" dari kemarin ga usah
// diingetin ulang tiap hari -- biar ga spam WA-nya.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(
      "id, student_id, class_id, next_due_date, students:student_id (name, phone, payment_status), classes:class_id (name, billing_type)"
    )
    .eq("request_status", "APPROVED")
    .eq("status", "ACTIVE")
    .lte("next_due_date", todayStr);

  const dueList = (enrollments ?? []).filter(
    (row: any) => row.classes?.billing_type === "MONTHLY"
  );

  if (dueList.length === 0) {
    return NextResponse.json({
      success: true,
      message: "Enggak ada kelas bulanan yang jatuh tempo hari ini.",
    });
  }

  let flaggedCount = 0;
  let alreadyDueCount = 0;

  for (const row of dueList as any[]) {
    const student = row.students;
    const cls = row.classes;

    if (student?.payment_status === "JATUH TEMPO") {
      alreadyDueCount += 1;
      continue;
    }

    await supabase
      .from("students")
      .update({ payment_status: "JATUH TEMPO" })
      .eq("id", row.student_id);
    flaggedCount += 1;

    if (student?.phone) {
      const msg = `⏰ Pembayaran bulanan kelas "${cls?.name || "-"}" kamu udah jatuh tempo. Yuk bayar lagi biar kelasnya lanjut terus.\n\nBayar di: ${SITE_URL}/class-cards`;
      try {
        const result = await sendWhatsApp(normalizePhone(student.phone), msg);
        if (!result.success) {
          await recordNotificationFailure(
            `Gagal kirim reminder "jatuh tempo" ke Murid ${student.name || "-"} (${student.phone}) buat kelas "${cls?.name || "-"}". Alasan: ${result.reason || "tidak diketahui"}.`
          );
        }
      } catch (err) {
        await recordNotificationFailure(
          `Gagal kirim reminder "jatuh tempo" ke Murid ${student.name || "-"} (${student.phone}) buat kelas "${cls?.name || "-"}". Error: ${err instanceof Error ? err.message : String(err)}.`
        );
      }
    } else {
      await recordNotificationFailure(
        `Murid ${student?.name || "-"} belum punya nomor HP di data Students, jadi reminder "jatuh tempo" buat kelas "${cls?.name || "-"}" enggak bisa dikirim WA.`
      );
    }

    await broadcastToBm(
      `📌 Murid ${student?.name || "-"} jatuh tempo bayar bulanan buat kelas "${cls?.name || "-"}".`,
      `Murid Jatuh Tempo: ${student?.name || "-"}`
    );
  }

  return NextResponse.json({
    success: true,
    message: `${flaggedCount} Murid baru ditandai Jatuh Tempo (${alreadyDueCount} udah Jatuh Tempo dari sebelumnya, ga diulang notifnya).`,
  });
}
