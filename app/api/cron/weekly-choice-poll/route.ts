import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyChoicePolls } from "@/lib/weeklyChoicePoll";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { sentCount, results } = await sendWeeklyChoicePolls();

  return NextResponse.json({
    success: true,
    message: `${sentCount} pesan poll terkirim`,
    details: results,
  });
}
