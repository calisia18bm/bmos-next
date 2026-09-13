"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// PENTING: dulu tiap fungsi di file ini nembak auth.getUser() + query
// user_profiles-nya SENDIRI-SENDIRI, padahal getCurrentProfile() (yang
// di-cache per request di lib/auth.ts) udah nyimpen hasil yang SAMA
// PERSIS. Ganti ke getCurrentProfile() di sini ngilangin panggilan
// auth+DB yang dobel-dobel itu -- kerasa lumayan di halaman Home yang
// manggil getUnreadAnnouncementCount() & markAnnouncementsRead() sekali
// jalan.
async function requireOwnerOrAdmin(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile) return "Belum login.";

  if (!profile.roles.includes("OWNER") && !profile.roles.includes("ADMIN")) {
    return "Cuma Owner/Admin yang bisa posting pengumuman.";
  }
  return null;
}

// audienceFilter dipakai buat Home murid/laoshi -- cuma ambil pengumuman
// yang emang buat mereka ('ALL' + role mereka sendiri). Owner/Admin (di
// widget kelola) manggil tanpa filter biar liat SEMUA pengumuman.
export async function getAnnouncements(limit = 5, audienceFilter?: string[]) {
  const supabase = await createClient();
  let query = supabase
    .from("announcements")
    .select("id, title, message, audience, created_by, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (audienceFilter) {
    query = query.in("audience", audienceFilter);
  }

  const { data } = await query;
  return data ?? [];
}

// Berapa banyak pengumuman yang belum pernah dibuka user yang lagi login
// -- dipakai buat badge notif angka di sidebar (menu "Home"). Owner ga
// dihitung (dashboard Owner sendiri ga nampilin widget Pengumuman, jadi
// ga relevan buat dia).
export async function getUnreadAnnouncementCount(): Promise<number> {
  const profile = await getCurrentProfile();
  if (!profile) return 0;
  if (profile.roles.includes("OWNER")) return 0;

  const isTeacher = profile.roles.includes("TEACHER");
  const isStudent = profile.roles.includes("STUDENT");
  const audience = isTeacher
    ? ["ALL", "TEACHER"]
    : isStudent
    ? ["ALL", "STUDENT"]
    : ["ALL"];

  const supabase = await createClient();
  const { count } = await supabase
    .from("announcements")
    .select("*", { count: "exact", head: true })
    .in("audience", audience)
    .gt("created_at", profile.last_announcement_read_at);

  return count ?? 0;
}

// Dipanggil dari Home (SimpleHome) tiap kali user (Laoshi/Murid/Admin)
// buka halaman itu & lihat widget Pengumuman -- nandain "udah dibaca
// sampai sekarang", biar badge notif di sidebar ilang.
export async function markAnnouncementsRead() {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const supabase = await createClient();
  await supabase
    .from("user_profiles")
    .update({ last_announcement_read_at: new Date().toISOString() })
    .eq("id", profile.id);
}

export async function createAnnouncement(input: {
  title: string;
  message: string;
  audience: "ALL" | "TEACHER" | "STUDENT";
}) {
  const authError = await requireOwnerOrAdmin();
  if (authError) return { success: false, message: authError };

  const profile = await getCurrentProfile();

  const title = input.title.trim();
  const message = input.message.trim();
  if (!title || !message) {
    return { success: false, message: "Judul dan isi pengumuman wajib diisi." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    title,
    message,
    audience: input.audience,
    created_by: profile?.full_name || "Owner/Admin",
  });

  if (error) return { success: false, message: error.message };

  revalidatePath("/", "layout");
  return { success: true, message: "Pengumuman berhasil diposting." };
}

export async function deleteAnnouncement(id: string) {
  const authError = await requireOwnerOrAdmin();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/", "layout");
  return { success: true, message: "Pengumuman dihapus." };
}
