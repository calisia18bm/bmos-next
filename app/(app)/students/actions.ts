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
