import { createClient } from "@/lib/supabase/server";

export type UserProfile = {
  id: string;
  email: string;
  roles: string[];
  active_role: string | null;
  character_key: string | null;
  full_name: string | null;
};

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, email, roles, active_role, character_key, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // User sudah login di Supabase Auth, tapi belum punya baris di
    // user_profiles (belum di-assign role). Anggap belum "terdaftar".
    return null;
  }

  return {
    id: profile.id,
    email: profile.email,
    roles: profile.roles || [],
    active_role: profile.active_role || profile.roles?.[0] || null,
    character_key: profile.character_key || null,
    full_name: profile.full_name || null,
  };
}
