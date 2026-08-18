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
