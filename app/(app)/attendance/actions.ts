"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveAttendance(
  classId: string,
  date: string,
  records: { studentId: string; status: string }[]
) {
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
