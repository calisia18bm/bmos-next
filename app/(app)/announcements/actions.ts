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
