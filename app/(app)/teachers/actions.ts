"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { provisionLinkedAccount } from "@/lib/account-provisioning";

// Cuma Owner/Admin yang boleh kelola data laoshi (kontak, rate per sesi,
// dsb) -- Laoshi liat data mereka sendiri lewat halaman portal (my-schedule,
// my-payroll), bukan dari sini.
async function requireStaff(): Promise<string | null> {
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
    return "Kamu ga punya akses buat kelola data laoshi.";
  }
  return null;
}

export async function updateTeacher(
  id: string,
  formData: {
    name: string;
    phone: string;
    ratePerSession: string;
    sessionsPerPayout: string;
    active: boolean;
  }
) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  const { error } = await supabase
    .from("teachers")
    .update({
      name: formData.name,
      phone: formData.phone || null,
      rate_per_session: Number(formData.ratePerSession) || 0,
      sessions_per_payout: Number(formData.sessionsPerPayout) || 8,
      active: formData.active,
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/teachers");
  return { success: true, message: "Data laoshi berhasil diperbarui." };
}

export async function addTeacher(formData: {
  name: string;
  phone: string;
  ratePerSession: string;
  // Opsional: kalau Owner mau sekalian bikinin akun login pas nambah
  // laoshi baru (bukan lewat halaman Accounts terpisah).
  createAccount?: boolean;
  email?: string;
  password?: string;
}) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  const { data: last } = await supabase
    .from("teachers")
    .select("teacher_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (last?.teacher_code) {
    const match = last.teacher_code.match(/\d+/);
    if (match) nextNumber = parseInt(match[0], 10) + 1;
  }
  const teacherCode = `L${String(nextNumber).padStart(3, "0")}`;

  const { data: inserted, error } = await supabase
    .from("teachers")
    .insert({
      teacher_code: teacherCode,
      name: formData.name,
      phone: formData.phone,
      rate_per_session: Number(formData.ratePerSession) || 0,
      active: true,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, message: error?.message || "Gagal menambahkan laoshi." };
  }

  revalidatePath("/teachers");

  // Kalau Owner centang "buatkan akun login sekaligus" dan isi email --
  // langsung bikinin akunnya juga, kesambung ke laoshi yang baru dibuat
  // ini. Kalau gagal (misal bukan Owner yang nambah, atau emailnya udah
  // dipakai), data laoshinya TETAP kesimpen -- cuma akunnya yang ga jadi,
  // dikasih tau lewat accountWarning.
  let account: { email: string; password: string } | undefined;
  let accountWarning: string | undefined;

  if (formData.createAccount && formData.email) {
    const result = await provisionLinkedAccount({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      roles: ["TEACHER"],
      teacherId: inserted.id,
    });

    if (result.created) {
      account = { email: result.email, password: result.password };
      revalidatePath("/accounts");
    } else {
      accountWarning = result.reason;
    }
  }

  return {
    success: true,
    message: "Laoshi berhasil ditambahkan.",
    account,
    accountWarning,
  };
}
