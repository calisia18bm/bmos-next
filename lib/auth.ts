import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type UserProfile = {
  id: string;
  email: string;
  roles: string[];
  active_role: string | null;
  character_key: string | null;
  full_name: string | null;
  teacher_id: string | null;
  student_id: string | null;
};

// PENTING: dibungkus cache() dari React -- hampir SEMUA page.tsx manggil
// getCurrentProfile() sendiri-sendiri, PADAHAL app/(app)/layout.tsx yang
// selalu membungkus semua halaman itu JUGA manggil getCurrentProfile().
// Jadi 1x buka/refresh halaman = getCurrentProfile() (dan auth.getUser()
// di dalamnya) kepanggil 2x secara paralel dalam request yang sama.
//
// Kalau access token user lagi mepet/udah kadaluarsa pas itu (misal abis
// ga buka web beberapa saat), auth.getUser() bakal coba refresh token.
// Refresh token Supabase itu sekali pakai (rotating) -- kalau 2 panggilan
// bareng-bareng SAMA-SAMA nyoba refresh pake refresh token yang sama,
// yang kedua bakal gagal ("refresh token already used") dan getUser()
// balikin user: null padahal user-nya beneran masih login. Ini penyebab
// munculnya "Akun belum diaktifkan" yang ilang-ilangan pas refresh.
//
// cache() bikin React nge-dedupe: dalam satu request/render yang sama,
// getCurrentProfile() cuma BENERAN jalan sekali (panggilan berikutnya
// dalam request yang sama langsung dapet hasil yang sama), jadi cuma ada
// 1 percobaan refresh token per request -- ga ada lagi race-nya.
export const getCurrentProfile = cache(async (): Promise<UserProfile | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select(
      "id, email, roles, active_role, character_key, full_name, teacher_id, student_id"
    )
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
    teacher_id: profile.teacher_id || null,
    student_id: profile.student_id || null,
  };
});
