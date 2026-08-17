import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/fonnte";

export async function GET(req: NextRequest) {
  // Proteksi -- cuma Vercel Cron (atau orang yang tau CRON_SECRET) yang boleh panggil ini
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: contentToday } = await supabase
    .from("content_calendar")
    .select("*")
    .eq("scheduled_date", today)
    .eq("status", "PLANNED");

  if (!contentToday || contentToday.length === 0) {
    return NextResponse.json({ success: true, message: "Tidak ada konten hari ini" });
  }

  const ownerPhone = process.env.OWNER_WHATSAPP_NUMBER;
  if (!ownerPhone) {
    return NextResponse.json({ success: false, message: "OWNER_WHATSAPP_NUMBER belum di-set" });
  }

  const lines = contentToday.map(
    (c) => `- ${c.title} (${c.platform})${c.notes ? " -- " + c.notes : ""}`
  );
  const message = `📅 Reminder: ada ${contentToday.length} konten dijadwalkan posting hari ini:\n\n${lines.join("\n")}`;

  await sendWhatsApp(ownerPhone, message);

  return NextResponse.json({ success: true, message: `Reminder dikirim, ${contentToday.length} konten` });
}
