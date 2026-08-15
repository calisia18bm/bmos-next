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
