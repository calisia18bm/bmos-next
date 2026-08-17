"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addFollowUp(formData: {
  leadId: string;
  dueDate: string;
  note: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("follow_ups").insert({
    lead_id: formData.leadId || null,
    due_date: formData.dueDate,
    note: formData.note,
    completed: false,
  });

  if (error) return { success: false, message: error.message };

  revalidatePath("/follow-up");
  return { success: true, message: "Follow up berhasil ditambahkan." };
}

export async function toggleFollowUp(id: string, completed: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("follow_ups")
    .update({ completed })
    .eq("id", id);

  if (error) return { success: false, message: error.message };
  revalidatePath("/follow-up");
  return { success: true, message: "Follow up diperbarui." };
}
