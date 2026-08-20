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

// Dipakai di semua action di file ini -- pengelolaan akun (bikin/edit
// akun orang lain, reset password orang lain) sekarang cuma buat OWNER.
// Return null kalau lolos (beserta id user yang lagi login), atau pesan
// error.
async function requireOwner(): Promise<
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
  if (!myRoles.includes("OWNER")) {
    return { error: "Cuma Owner yang bisa kelola akun." };
  }

  return { error: null, userId: user.id, roles: myRoles };
}

// Bikin akun BMOS baru (owner/admin/laoshi/murid) lengkap dengan login
// Supabase Auth-nya. Cuma boleh dipanggil sama OWNER yang lagi login --
// dicek ulang di server biar ga bisa dilewatin dari luar.
// Password boleh diisi manual (opsional) -- kalau dikosongin, di-generate
// otomatis. teacherId/studentId dipakai buat nyambungin akun ini ke data
// Laoshi/Murid yang udah ada di Master Data (biar home & materi bisa
// tau kelas mana yang relevan buat akun ini).
export async function createAccount(input: {
  name: string;
  email: string;
  roles: string[];
  password?: string;
  teacherId?: string | null;
  studentId?: string | null;
}) {
  const auth = await requireOwner();
  if (auth.error !== null) return { success: false, message: auth.error };

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) return { success: false, message: "Nama wajib diisi." };
  if (!email) return { success: false, message: "Email wajib diisi." };
  if (input.roles.length === 0) {
    return { success: false, message: "Pilih minimal satu role." };
  }
  const customPassword = (input.password || "").trim();
  if (customPassword && customPassword.length < 6) {
    return {
      success: false,
      message: "Password minimal 6 karakter.",
    };
  }

  const password = customPassword || generatePassword();
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
    teacher_id: input.roles.includes("TEACHER") ? input.teacherId || null : null,
    student_id: input.roles.includes("STUDENT") ? input.studentId || null : null,
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
  input: {
    name: string;
    roles: string[];
    teacherId?: string | null;
    studentId?: string | null;
  }
) {
  const auth = await requireOwner();
  if (auth.error !== null) return { success: false, message: auth.error };

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
      teacher_id: input.roles.includes("TEACHER") ? input.teacherId || null : null,
      student_id: input.roles.includes("STUDENT") ? input.studentId || null : null,
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/accounts");
  return { success: true, message: "Akun berhasil diperbarui." };
}

// Reset password akun siapapun -- dipakai Owner buat bantu orang yang
// lupa password. Generate password baru (bukan kirim email reset),
// langsung ditampilkan sekali ke Owner yang mereset, buat dikasih tau
// manual ke orangnya.
export async function resetAccountPassword(id: string) {
  const auth = await requireOwner();
  if (auth.error !== null) return { success: false, message: auth.error };

  const password = generatePassword();
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.updateUserById(id, { password });

  if (error) return { success: false, message: error.message };

  return { success: true, message: "Password berhasil direset.", password };
}
