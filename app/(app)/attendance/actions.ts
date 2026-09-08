"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Owner/Admin/Laoshi boleh catat & koreksi absensi (Laoshi buat kelas
// yang dia ajar sendiri).
async function requireStaffOrTeacher(): Promise<string | null> {
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
  if (
    !myRoles.includes("OWNER") &&
    !myRoles.includes("ADMIN") &&
    !myRoles.includes("TEACHER")
  ) {
    return "Kamu ga punya akses buat catat absensi.";
  }
  return null;
}

// Koreksi 1 baris absensi yang sudah tersimpan (misal salah pencet
// Hadir/Izin/Alpha). Dipakai dari halaman detail murid supaya bisa
// dibetulkan langsung tanpa harus balik ke form Attendance per kelas.
export async function updateAttendanceRecord(
  id: string,
  status: string,
  studentId: string
) {
  const authError = await requireStaffOrTeacher();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  const { error } = await supabase
    .from("attendance")
    .update({ status })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/attendance");
  return { success: true, message: "Absensi berhasil diperbarui." };
}

export async function saveAttendance(
  classId: string,
  date: string,
  records: { studentId: string; status: string }[]
) {
  const authError = await requireStaffOrTeacher();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  // Hapus dulu absensi lama buat kelas+tanggal ini (biar bisa di-edit ulang
  // tanpa numpuk baris dobel kalau disimpan berkali-kali).
  await supabase
    .from("attendance")
    .delete()
    .eq("class_id", classId)
    .eq("attendance_date", date);

  const rows = records.map((r) => ({
    class_id: classId,
    student_id: r.studentId,
    attendance_date: date,
    status: r.status,
  }));

  const { error } = await supabase.from("attendance").insert(rows);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/attendance");
  return { success: true, message: "Absensi berhasil disimpan." };
}
