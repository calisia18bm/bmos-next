"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// User ganti karakter maskot favoritnya sendiri (dipakai sbg avatar di
// sidebar & dashboard). Cuma bisa ganti punya sendiri (pakai auth.uid()).
export async function updateMyCharacter(characterKey: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, message: "Belum login." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({ character_key: characterKey })
    .eq("id", profile.id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/", "layout");
  return { success: true, message: "Karakter berhasil diganti." };
}

// User ganti nama lengkapnya sendiri (muncul di sapaan "Selamat Datang").
// Cuma bisa ganti punya sendiri (pakai auth.uid()).
export async function updateMyName(fullName: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, message: "Belum login." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({ full_name: fullName.trim() || null })
    .eq("id", profile.id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/", "layout");
  return { success: true, message: "Nama berhasil disimpan." };
}
