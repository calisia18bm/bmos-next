"use server";

import { getCurrentProfile } from "@/lib/auth";
import { runSheetsSync, SyncResult } from "@/lib/sheetsExport";

export async function syncSheetsNow(): Promise<SyncResult> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.roles.includes("OWNER")) {
    return { ok: false, message: "Cuma Owner yang bisa sinkron ke Google Sheets.", tabs: [] };
  }
  return runSheetsSync();
}
