import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Endpoint publik (TANPA login) buat halaman Login -- biar logo di
// halaman Login bisa nunjukkin karakter maskot yang sama kayak yang
// dipilih Owner di sidebar (app_settings.global_character_key), tanpa
// perlu buka akses RLS app_settings ke user anonim. Cuma balikin 1 field
// doang (character key), ga ada data sensitif.
export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("app_settings")
    .select("global_character_key")
    .eq("id", 1)
    .maybeSingle();

  return NextResponse.json({ key: data?.global_character_key ?? null });
}
