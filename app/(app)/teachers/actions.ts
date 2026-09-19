"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { provisionLinkedAccount } from "@/lib/account-provisioning";

// Cuma Owner/Admin yang boleh kelola data laoshi (kontak, rate per sesi,
// dsb) -- Laoshi liat data mereka sendiri lewat halaman portal (my-schedule,
// my-payroll), bukan dari sini.
async function requireStaff(): Promise<string | null> {
  const profile = await getCurrentProfile();

  if (!profile) return "Belum login.";

  const myRoles = profile.roles;
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
    // "SESSION" = dibayar per sesi diajar (rate_per_session x jumlah sesi).
    // "PACKAGE" = dibayar flat per PAKET (sekian sesi selesai = flat
    // rate_per_package), dipakai buat laoshi yang gajinya bukan hitungan
    // per sesi.
    rateType: "SESSION" | "PACKAGE";
    ratePerSession: string;
    ratePerPackage: string;
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
      rate_type: formData.rateType,
      rate_per_session: Number(formData.ratePerSession) || 0,
      rate_per_package: Number(formData.ratePerPackage) || 0,
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
  rateType: "SESSION" | "PACKAGE";
  ratePerSession: string;
  ratePerPackage: string;
  sessionsPerPayout: string;
  // Opsional: kalau Owner mau sekalian bikinin akun login pas nambah
  // laoshi baru (bukan lewat halaman Accounts terpisah).
  createAccount?: boolean;
  email?: string;
  password?: string;
}) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  // Sama kayak bug student_code yang udah dibenerin sebelumnya -- ambil
  // nomor TERBESAR dari SEMUA kode yang ada (bukan cuma baris yang paling
  // baru dibuat), soalnya bisa aja divergen kalau data ga selalu masuk
  // berurutan. Dikasih retry kalau kebetulan masih bentrok (misal 2 orang
  // nambah laoshi bebarengan).
  const { data: allCodes } = await supabase
    .from("teachers")
    .select("teacher_code");

  let maxNumber = 0;
  (allCodes ?? []).forEach((row) => {
    const match = row.teacher_code?.match(/\d+/);
    if (match) {
      const n = parseInt(match[0], 10);
      if (n > maxNumber) maxNumber = n;
    }
  });

  let inserted: { id: string } | null = null;
  let error: { message: string } | null = null;

  for (let i = 0; i < 5; i++) {
    const teacherCode = `L${String(maxNumber + 1 + i).padStart(3, "0")}`;

    const result = await supabase
      .from("teachers")
      .insert({
        teacher_code: teacherCode,
        name: formData.name,
        phone: formData.phone,
        rate_type: formData.rateType,
        rate_per_session: Number(formData.ratePerSession) || 0,
        rate_per_package: Number(formData.ratePerPackage) || 0,
        sessions_per_payout: Number(formData.sessionsPerPayout) || 8,
        active: true,
      })
      .select("id")
      .single();

    if (!result.error && result.data) {
      inserted = result.data;
      error = null;
      break;
    }

    error = result.error;
    const isDuplicateCode = result.error?.message.includes("teachers_teacher_code_key");
    if (!isDuplicateCode) break;
    // Kode ini baru aja kepake (kemungkinan laoshi lain baru ditambahin
    // bareng), coba nomor berikutnya.
  }

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
