"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function addContent(formData: {
  title: string;
  platform: string;
  scheduledDate: string;
  notes: string;
  imageUrl: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("content_calendar").insert({
    title: formData.title,
    platform: formData.platform,
    scheduled_date: formData.scheduledDate,
    notes: formData.notes,
    image_url: formData.imageUrl || null,
    status: "PLANNED",
  });

  if (error) return { success: false, message: error.message };

  revalidatePath("/content-calendar");
  return { success: true, message: "Konten berhasil dijadwalkan." };
}

export async function updateContentStatus(id: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("content_calendar")
    .update({ status })
    .eq("id", id);

  if (error) return { success: false, message: error.message };
  revalidatePath("/content-calendar");
  return { success: true, message: "Status konten diperbarui." };
}
