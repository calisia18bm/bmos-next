"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireOwnerOrAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Belum login.";

  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .maybeSingle();

  const myRoles = myProfile?.roles || [];
  if (!myRoles.includes("OWNER") && !myRoles.includes("ADMIN")) {
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("roles, last_announcement_read_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!myProfile) return 0;

  const roles = (myProfile.roles || []) as string[];
  if (roles.includes("OWNER")) return 0;

  const isTeacher = roles.includes("TEACHER");
  const isStudent = roles.includes("STUDENT");
  const audience = isTeacher
    ? ["ALL", "TEACHER"]
    : isStudent
    ? ["ALL", "STUDENT"]
    : ["ALL"];

  const { count } = await supabase
    .from("announcements")
    .select("*", { count: "exact", head: true })
    .in("audience", audience)
    .gt("created_at", myProfile.last_announcement_read_at);

  return count ?? 0;
}

// Dipanggil dari Home (SimpleHome) tiap kali user (Laoshi/Murid/Admin)
// buka halaman itu & lihat widget Pengumuman -- nandain "udah dibaca
// sampai sekarang", biar badge notif di sidebar ilang.
export async function markAnnouncementsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("user_profiles")
    .update({ last_announcement_read_at: new Date().toISOString() })
    .eq("id", user.id);
}

export async function createAnnouncement(input: {
  title: string;
  message: string;
  audience: "ALL" | "TEACHER" | "STUDENT";
}) {
  const authError = await requireOwnerOrAdmin();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", user!.id)
    .maybeSingle();

  const title = input.title.trim();
  const message = input.message.trim();
  if (!title || !message) {
    return { success: false, message: "Judul dan isi pengumuman wajib diisi." };
  }

  const { error } = await supabase.from("announcements").insert({
    title,
    message,
    audience: input.audience,
    created_by: myProfile?.full_name || "Owner/Admin",
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
