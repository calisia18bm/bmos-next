"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function generatePayrollDraft(formData: {
  teacherId: string;
  periodStart: string;
  periodEnd: string;
}) {
  const supabase = await createClient();

  const { data: teacher } = await supabase
    .from("teachers")
    .select("name, rate_per_session")
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

  const ratePerSession = Number(teacher.rate_per_session) || 0;
  const totalAmount = sessionsCount * ratePerSession;

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
    rate_per_session: ratePerSession,
    total_amount: totalAmount,
    status: "DRAFT",
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/payroll");
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
