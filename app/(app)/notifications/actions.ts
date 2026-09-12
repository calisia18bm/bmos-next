"use server";

import { createClient } from "@/lib/supabase/server";

// Berapa banyak catatan "notifikasi WA gagal terkirim" yang belum
// ditandai selesai -- dipakai buat widget "Need Attention" di Home Owner
// (lihat lib/notifyFailure.ts buat penjelasan kenapa dicatet di DB, bukan
// cuma dikirim WA doang).
export async function getUnresolvedNotificationFailureCount() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notification_failures")
    .select("*", { count: "exact", head: true })
    .eq("resolved", false);
  return count ?? 0;
}
