"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addStudent(formData: {
  name: string;
  phone: string;
}) {
  const supabase = await createClient();

  // Generate kode murid berikutnya, misal M0001 -> M0002
  const { data: last } = await supabase
    .from("students")
    .select("student_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (last?.student_code) {
    const match = last.student_code.match(/\d+/);
    if (match) nextNumber = parseInt(match[0], 10) + 1;
  }
  const studentCode = `M${String(nextNumber).padStart(4, "0")}`;

  const { error } = await supabase.from("students").insert({
    student_code: studentCode,
    name: formData.name,
    phone: formData.phone,
    status: "ACTIVE",
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/students");
  return { success: true, message: "Murid berhasil ditambahkan." };
}

export async function addAdditionalClass(
  studentId: string,
  classId: string
) {
  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .maybeSingle();

  if (!cls) return { success: false, message: "Kelas tidak ditemukan." };

  // Cek jangan sampai dobel -- murid udah aktif di kelas ini
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (existing) {
    return { success: false, message: `Murid sudah aktif di kelas ${cls.name}.` };
  }

  const { data: last } = await supabase
    .from("enrollments")
    .select("enrollment_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (last?.enrollment_code) {
    const match = last.enrollment_code.match(/\d+/);
    if (match) nextNumber = parseInt(match[0], 10) + 1;
  }
  const enrollmentCode = `ENR${String(nextNumber).padStart(5, "0")}`;

  const { error } = await supabase.from("enrollments").insert({
    enrollment_code: enrollmentCode,
    student_id: studentId,
    class_id: classId,
    status: "ACTIVE",
    started_at: new Date().toISOString().slice(0, 10),
  });

  if (error) return { success: false, message: error.message };

  revalidatePath(`/students/${studentId}`);
  return { success: true, message: `Berhasil ditambahkan ke kelas ${cls.name}.` };
}

export async function endEnrollment(enrollmentId: string, studentId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("enrollments")
    .update({ status: "FINISHED", ended_at: new Date().toISOString().slice(0, 10) })
    .eq("id", enrollmentId);

  if (error) return { success: false, message: error.message };

  revalidatePath(`/students/${studentId}`);
  return { success: true, message: "Kelas berhasil dihentikan." };
}

export async function transferClass(
  studentId: string,
  fromEnrollmentId: string,
  newClassId: string,
  reason: string
) {
  const supabase = await createClient();

  const { data: newClass } = await supabase
    .from("classes")
    .select("id, name, teacher_name")
    .eq("id", newClassId)
    .maybeSingle();

  if (!newClass) return { success: false, message: "Kelas tujuan tidak ditemukan." };

  const today = new Date().toISOString().slice(0, 10);

  // Tutup CUMA enrollment yang dipilih (bukan semua), biar aman kalau
  // murid lagi ikut lebih dari 1 kelas.
  const { error: closeError } = await supabase
    .from("enrollments")
    .update({ status: "FINISHED", ended_at: today })
    .eq("id", fromEnrollmentId);

  if (closeError) return { success: false, message: closeError.message };

  const { data: last } = await supabase
    .from("enrollments")
    .select("enrollment_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (last?.enrollment_code) {
    const match = last.enrollment_code.match(/\d+/);
    if (match) nextNumber = parseInt(match[0], 10) + 1;
  }
  const enrollmentCode = `ENR${String(nextNumber).padStart(5, "0")}`;

  const { error: enrollError } = await supabase.from("enrollments").insert({
    enrollment_code: enrollmentCode,
    student_id: studentId,
    class_id: newClassId,
    status: "ACTIVE",
    started_at: today,
  });

  if (enrollError) return { success: false, message: enrollError.message };

  // Cek: abis transfer ini, apa masih ada enrollment aktif lain? Kalau
  // nggak ada (ini kelas satu-satunya), update juga field class_id utama
  // di tabel students biar tampilan lama (list, dsb) tetep sinkron.
  const { data: stillActive } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "ACTIVE");

  if ((stillActive ?? []).length <= 1) {
    await supabase
      .from("students")
      .update({
        class_id: newClassId,
        class_name: newClass.name,
        teacher_name: newClass.teacher_name,
        notes: reason ? `Pindah kelas: ${reason}` : undefined,
      })
      .eq("id", studentId);
  }

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  return { success: true, message: `Berhasil pindah ke kelas ${newClass.name}.` };
}

export async function updateStudent(
  id: string,
  formData: {
    name: string;
    phone: string;
    classId: string;
    className: string;
    teacherName: string;
    sessionsPerPackage: string;
    packagePrice: string;
    status: string;
    notes: string;
  }
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("students")
    .update({
      name: formData.name,
      phone: formData.phone || null,
      class_id: formData.classId || null,
      class_name: formData.className || null,
      teacher_name: formData.teacherName || null,
      sessions_per_package: Number(formData.sessionsPerPackage) || 4,
      package_price: Number(formData.packagePrice) || 0,
      status: formData.status,
      notes: formData.notes || null,
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  return { success: true, message: "Data murid berhasil diperbarui." };
}
