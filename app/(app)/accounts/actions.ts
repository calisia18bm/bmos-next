"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function generatePassword() {
  // Password acak yang gampang dibaca/diketik ulang (dikirim manual ke
  // orangnya lewat WhatsApp dsb, bukan lewat email otomatis).
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 10; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

// Bikin akun BMOS baru (owner/admin/laoshi/murid) lengkap dengan login
// Supabase Auth-nya. Cuma boleh dipanggil sama OWNER atau ADMIN yang lagi
// login -- dicek ulang di server biar ga bisa dilewatin dari luar.
export async function createAccount(input: {
  name: string;
  email: string;
  roles: string[];
}) {
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

  const myRoles = myProfile?.roles || [];
  if (!myRoles.includes("OWNER") && !myRoles.includes("ADMIN")) {
    return {
      success: false,
      message: "Kamu tidak punya akses untuk membuat akun baru.",
    };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) return { success: false, message: "Nama wajib diisi." };
  if (!email) return { success: false, message: "Email wajib diisi." };
  if (input.roles.length === 0) {
    return { success: false, message: "Pilih minimal satu role." };
  }

  const password = generatePassword();
  const admin = createAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createErr || !created?.user) {
    return {
      success: false,
      message: createErr?.message || "Gagal membuat akun.",
    };
  }

  const { error: profileErr } = await admin.from("user_profiles").insert({
    id: created.user.id,
    email,
    full_name: name,
    roles: input.roles,
    active_role: input.roles[0],
  });

  if (profileErr) {
    // Rollback -- jangan sampai ada akun auth "nyantol" tanpa profil.
    await admin.auth.admin.deleteUser(created.user.id);
    return { success: false, message: profileErr.message };
  }

  revalidatePath("/accounts");
  return {
    success: true,
    message: "Akun berhasil dibuat.",
    email,
    password,
  };
}
