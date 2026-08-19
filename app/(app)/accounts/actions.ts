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

// Dipakai di semua action di file ini -- cuma OWNER/ADMIN yang boleh
// kelola akun orang lain. Return null kalau lolos (beserta id & role user
// yang lagi login), atau pesan error.
async function requireOwnerOrAdmin(): Promise<
  { error: string } | { error: null; userId: string; roles: string[] }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Belum login." };

  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .maybeSingle();

  const myRoles = myProfile?.roles || [];
  if (!myRoles.includes("OWNER") && !myRoles.includes("ADMIN")) {
    return { error: "Kamu tidak punya akses untuk kelola akun." };
  }

  return { error: null, userId: user.id, roles: myRoles };
}

// Bikin akun BMOS baru (owner/admin/laoshi/murid) lengkap dengan login
// Supabase Auth-nya. Cuma boleh dipanggil sama OWNER atau ADMIN yang lagi
// login -- dicek ulang di server biar ga bisa dilewatin dari luar.
export async function createAccount(input: {
  name: string;
  email: string;
  roles: string[];
}) {
  const auth = await requireOwnerOrAdmin();
  if (auth.error) return { success: false, message: auth.error };

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

// Edit nama & role akun yang sudah ada.
export async function updateAccount(
  id: string,
  input: { name: string; roles: string[] }
) {
  const auth = await requireOwnerOrAdmin();
  if (auth.error) return { success: false, message: auth.error };

  const name = input.name.trim();
  if (!name) return { success: false, message: "Nama wajib diisi." };
  if (input.roles.length === 0) {
    return { success: false, message: "Pilih minimal satu role." };
  }

  // Jaga-jaga biar ga ada yang ga sengaja hapus role Owner dari akun
  // sendiri (jadi ke-lock out ga bisa akses Accounts lagi). Kalau mau
  // lepas Owner dari diri sendiri, minta Owner lain yang ubah.
  if (id === auth.userId && !input.roles.includes("OWNER")) {
    return {
      success: false,
      message:
        "Kamu tidak bisa menghapus role Owner dari akun sendiri. Minta Owner lain untuk mengubahnya.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_profiles")
    .update({
      full_name: name,
      roles: input.roles,
      active_role: input.roles[0],
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/accounts");
  return { success: true, message: "Akun berhasil diperbarui." };
}

// Reset password akun yang lupa password -- generate password baru
// (bukan kirim email reset), langsung ditampilkan sekali ke Owner/Admin
// yang mereset, buat dikasih tau manual ke orangnya.
export async function resetAccountPassword(id: string) {
  const auth = await requireOwnerOrAdmin();
  if (auth.error) return { success: false, message: auth.error };

  const password = generatePassword();
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(id, { password });

  if (error) return { success: false, message: error.message };

  return { success: true, message: "Password berhasil direset.", password };
}
