"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { BannerItem } from "@/lib/characters";

export async function getBannerLayout(): Promise<BannerItem[] | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("banner_layout")
    .eq("id", 1)
    .maybeSingle();
  return (data?.banner_layout as BannerItem[] | null) ?? null;
}

export async function saveBannerLayout(layout: BannerItem[]) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, banner_layout: layout });

  if (error) return { success: false, message: error.message };

  revalidatePath("/", "layout");
  return { success: true, message: "Layout banner berhasil disimpan." };
}

// Avatar karakter di sidebar itu SATU aja buat semua akun (bukan per-user
// lagi), disimpan di app_settings biar sama persis dimana-mana -- murid,
// laoshi, admin, semuanya liat karakter yang sama, yang cuma Owner bisa
// ganti.
export async function getGlobalCharacter(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("global_character_key")
    .eq("id", 1)
    .maybeSingle();
  return data?.global_character_key ?? null;
}

export async function updateGlobalCharacter(characterKey: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Belum login." };

  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .maybeSingle();

  if (!(myProfile?.roles || []).includes("OWNER")) {
    return { success: false, message: "Cuma Owner yang bisa ganti karakter." };
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, global_character_key: characterKey });

  if (error) return { success: false, message: error.message };

  revalidatePath("/", "layout");
  return { success: true, message: "Karakter berhasil diganti." };
}
