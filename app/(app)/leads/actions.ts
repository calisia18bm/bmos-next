"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addLead(formData: {
  name: string;
  phone: string;
  source: string;
  notes: string;
}) {
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("leads")
    .select("lead_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (last?.lead_code) {
    const match = last.lead_code.match(/\d+/);
    if (match) nextNumber = parseInt(match[0], 10) + 1;
  }
  const leadCode = `LD${String(nextNumber).padStart(4, "0")}`;

  const { error } = await supabase.from("leads").insert({
    lead_code: leadCode,
    name: formData.name,
    phone: formData.phone,
    source: formData.source,
    notes: formData.notes,
    status: "NEW",
  });

  if (error) return { success: false, message: error.message };

  revalidatePath("/leads");
  return { success: true, message: "Lead berhasil ditambahkan." };
}

export async function updateLeadStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", id);

  if (error) return { success: false, message: error.message };
  revalidatePath("/leads");
  return { success: true, message: "Status lead diperbarui." };
}
