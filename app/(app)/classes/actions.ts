"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const DAYS = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

export async function updateClass(
  id: string,
  formData: {
    name: string;
    teacherId: string;
    teacherName: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    capacityMax: string;
    active: boolean;
  }
) {
  const supabase = await createClient();

  if (formData.dayOfWeek && !DAYS.includes(formData.dayOfWeek)) {
    return { success: false, message: "Hari tidak valid." };
  }

  const { error } = await supabase
    .from("classes")
    .update({
      name: formData.name,
      teacher_id: formData.teacherId || null,
      teacher_name: formData.teacherName || null,
      day_of_week: formData.dayOfWeek || null,
      start_time: formData.startTime || null,
      end_time: formData.endTime || null,
      capacity_max: Number(formData.capacityMax) || 6,
      active: formData.active,
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/classes");
  return { success: true, message: "Data kelas berhasil diperbarui." };
}

export async function addClass(formData: {
  name: string;
  teacherId: string;
  teacherName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  capacityMax: string;
}) {
  const supabase = await createClient();

  if (formData.dayOfWeek && !DAYS.includes(formData.dayOfWeek)) {
    return { success: false, message: "Hari tidak valid." };
  }

  const { data: last } = await supabase
    .from("classes")
    .select("class_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (last?.class_code) {
    const match = last.class_code.match(/\d+/);
    if (match) nextNumber = parseInt(match[0], 10) + 1;
  }
  const classCode = `K${String(nextNumber).padStart(3, "0")}`;

  const { error } = await supabase.from("classes").insert({
    class_code: classCode,
    name: formData.name,
    teacher_id: formData.teacherId || null,
    teacher_name: formData.teacherName || null,
    day_of_week: formData.dayOfWeek || null,
    start_time: formData.startTime || null,
    end_time: formData.endTime || null,
    capacity_max: Number(formData.capacityMax) || 6,
    active: true,
    registration_open: true,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/classes");
  return { success: true, message: "Kelas berhasil ditambahkan." };
}
