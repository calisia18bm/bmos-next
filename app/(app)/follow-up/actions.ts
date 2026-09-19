"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// Cuma Owner/Admin yang boleh kelola follow-up leads.
async function requireStaff(): Promise<string | null> {
  const profile = await getCurrentProfile();

  if (!profile) return "Belum login.";

  const myRoles = profile.roles;
  if (!myRoles.includes("OWNER") && !myRoles.includes("ADMIN")) {
    return "Kamu ga punya akses buat kelola follow-up.";
  }
  return null;
}

export async function addFollowUp(formData: {
  leadId: string;
  dueDate: string;
  note: string;
}) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

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
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("follow_ups")
    .update({ completed })
    .eq("id", id);

  if (error) return { success: false, message: error.message };
  revalidatePath("/follow-up");
  return { success: true, message: "Follow up diperbarui." };
}
