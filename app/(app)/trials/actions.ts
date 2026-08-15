"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addTrial(formData: {
  name: string;
  phone: string;
  classId: string;
  scheduledDate: string;
  leadId: string;
}) {
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("trials")
    .select("trial_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (last?.trial_code) {
    const match = last.trial_code.match(/\d+/);
    if (match) nextNumber = parseInt(match[0], 10) + 1;
  }
  const trialCode = `TR${String(nextNumber).padStart(4, "0")}`;

  const { error } = await supabase.from("trials").insert({
    trial_code: trialCode,
    lead_id: formData.leadId || null,
    name: formData.name,
    phone: formData.phone,
    class_id: formData.classId || null,
    scheduled_date: formData.scheduledDate,
    status: "SCHEDULED",
  });

  if (error) return { success: false, message: error.message };

  revalidatePath("/trials");
  return { success: true, message: "Trial class berhasil dijadwalkan." };
}

export async function updateTrialStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("trials")
    .update({ status })
    .eq("id", id);

  if (error) return { success: false, message: error.message };
  revalidatePath("/trials");
  return { success: true, message: "Status trial diperbarui." };
}

export async function convertTrialToStudent(trialId: string) {
  const supabase = await createClient();

  const { data: trial } = await supabase
    .from("trials")
    .select("*")
    .eq("id", trialId)
    .maybeSingle();

  if (!trial) return { success: false, message: "Trial tidak ditemukan." };

  const { data: cls } = await supabase
    .from("classes")
    .select("name, teacher_name")
    .eq("id", trial.class_id)
    .maybeSingle();

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

  const { error: insertError } = await supabase.from("students").insert({
    student_code: studentCode,
    name: trial.name,
    phone: trial.phone,
    class_id: trial.class_id,
    class_name: cls?.name || null,
    teacher_name: cls?.teacher_name || null,
    status: "ACTIVE",
  });

  if (insertError) return { success: false, message: insertError.message };

  await supabase
    .from("trials")
    .update({ status: "CONVERTED" })
    .eq("id", trialId);

  if (trial.lead_id) {
    await supabase
      .from("leads")
      .update({ status: "CONVERTED" })
      .eq("id", trial.lead_id);
  }

  revalidatePath("/trials");
  revalidatePath("/students");
  revalidatePath("/leads");
  return { success: true, message: "Trial berhasil dikonversi jadi murid!" };
}
