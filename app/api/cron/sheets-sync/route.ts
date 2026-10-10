import { NextRequest, NextResponse } from "next/server";
import { runSheetsSync } from "@/lib/sheetsExport";

export const maxDuration = 60;

// Cron harian (lihat vercel.json) -- menyalin data BMOS ke Google Sheets.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const result = await runSheetsSync();
  return NextResponse.json({ success: result.ok, ...result });
}
