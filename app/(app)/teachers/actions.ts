"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
}) {
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

  const { error } = await supabase.from("teachers").insert({
    teacher_code: teacherCode,
    name: formData.name,
    phone: formData.phone,
    rate_per_session: Number(formData.ratePerSession) || 0,
    active: true,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/teachers");
  return { success: true, message: "Laoshi berhasil ditambahkan." };
}
