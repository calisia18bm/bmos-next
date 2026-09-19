"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Cuma Owner/Admin yang boleh kelola payroll laoshi (gaji/rate sensitif).
async function requireStaff(): Promise<string | null> {
  const profile = await getCurrentProfile();

  if (!profile) return "Belum login.";

  const myRoles = profile.roles;
  if (!myRoles.includes("OWNER") && !myRoles.includes("ADMIN")) {
    return "Kamu ga punya akses buat kelola payroll.";
  }
  return null;
}

export async function generatePayrollDraft(formData: {
  teacherId: string;
  periodStart: string;
  periodEnd: string;
}) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  const { data: teacher } = await supabase
    .from("teachers")
    .select("name, rate_type, rate_per_session, rate_per_package, sessions_per_payout")
    .eq("id", formData.teacherId)
    .maybeSingle();

  if (!teacher) {
    return { success: false, message: "Laoshi tidak ditemukan." };
  }

  // Cari semua kelas yang diajar laoshi ini
  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .eq("teacher_id", formData.teacherId);

  const classIds = (classes ?? []).map((c) => c.id);

  if (classIds.length === 0) {
    return {
      success: false,
      message: "Laoshi ini belum punya kelas.",
    };
  }

  // Hitung jumlah sesi unik (kelas + tanggal) dalam periode, berdasarkan
  // data absensi yang udah dicatat -- itu jadi bukti sesi beneran jalan.
  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("class_id, attendance_date")
    .in("class_id", classIds)
    .gte("attendance_date", formData.periodStart)
    .lte("attendance_date", formData.periodEnd);

  const uniqueSessions = new Set(
    (attendanceRows ?? []).map((r) => `${r.class_id}_${r.attendance_date}`)
  );
  const sessionsCount = uniqueSessions.size;

  if (sessionsCount === 0) {
    return {
      success: false,
      message: "Belum ada data absensi di periode ini untuk laoshi tersebut.",
    };
  }

  const isPackageRate = teacher.rate_type === "PACKAGE";
  const ratePerSession = Number(teacher.rate_per_session) || 0;
  const ratePerPackage = Number(teacher.rate_per_package) || 0;
  const sessionsPerPackage = Number(teacher.sessions_per_payout) || 8;

  // Per paket: cuma PAKET UTUH (kelipatan sessionsPerPackage) yang dibayar
  // di periode ini -- sisa sesi yang belum genap 1 paket otomatis ke-hitung
  // ulang di payroll periode berikutnya (asal tanggal sesinya dimasukin ke
  // rentang periode itu), soalnya sessionsCount selalu dihitung ulang dari
  // absensi tiap kali generate, bukan dari catatan "udah dibayar/belum".
  const packagesCount = isPackageRate
    ? Math.floor(sessionsCount / sessionsPerPackage)
    : 0;
  const leftoverSessions = isPackageRate
    ? sessionsCount % sessionsPerPackage
    : 0;

  if (isPackageRate && packagesCount === 0) {
    return {
      success: false,
      message: `Baru ${sessionsCount} dari ${sessionsPerPackage} sesi per paket -- belum genap 1 paket, jadi belum ada yang bisa dibayar di periode ini.`,
    };
  }

  const totalAmount = isPackageRate
    ? packagesCount * ratePerPackage
    : sessionsCount * ratePerSession;

  const { data: last } = await supabase
    .from("payroll")
    .select("payroll_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (last?.payroll_code) {
    const match = last.payroll_code.match(/\d+/);
    if (match) nextNumber = parseInt(match[0], 10) + 1;
  }
  const payrollCode = `PR${String(nextNumber).padStart(5, "0")}`;

  const { error } = await supabase.from("payroll").insert({
    payroll_code: payrollCode,
    teacher_id: formData.teacherId,
    teacher_name: teacher.name,
    period_start: formData.periodStart,
    period_end: formData.periodEnd,
    sessions_count: sessionsCount,
    rate_type: isPackageRate ? "PACKAGE" : "SESSION",
    rate_per_session: isPackageRate ? 0 : ratePerSession,
    rate_per_package: isPackageRate ? ratePerPackage : 0,
    packages_count: packagesCount,
    total_amount: totalAmount,
    status: "DRAFT",
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/payroll");

  if (isPackageRate) {
    let message = `Draft payroll dibuat: ${packagesCount} paket (${sessionsPerPackage} sesi/paket) x ${new Intl.NumberFormat(
      "id-ID"
    ).format(ratePerPackage)} = ${new Intl.NumberFormat("id-ID").format(totalAmount)}`;
    if (leftoverSessions > 0) {
      message += `. Sisa ${leftoverSessions} sesi belum genap 1 paket, otomatis ikut dihitung di payroll periode berikutnya.`;
    }
    return { success: true, message };
  }

  return {
    success: true,
    message: `Draft payroll dibuat: ${sessionsCount} sesi x ${new Intl.NumberFormat(
      "id-ID"
    ).format(ratePerSession)} = ${new Intl.NumberFormat("id-ID").format(
      totalAmount
    )}`,
  };
}

export async function approvePayroll(id: string) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll")
    .update({ status: "APPROVED" })
    .eq("id", id)
    .eq("status", "DRAFT");

  if (error) return { success: false, message: error.message };
  revalidatePath("/payroll");
  return { success: true, message: "Payroll disetujui." };
}

export async function markPayrollPaid(id: string) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll")
    .update({ status: "PAID", paid_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "APPROVED");

  if (error) return { success: false, message: error.message };
  revalidatePath("/payroll");
  return { success: true, message: "Payroll ditandai sudah dibayar." };
}
