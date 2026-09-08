"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Cuma Owner/Admin yang boleh kelola content calendar.
async function requireStaff(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Belum login.";

  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .maybeSingle();

  const myRoles = myProfile?.roles || [];
  if (!myRoles.includes("OWNER") && !myRoles.includes("ADMIN")) {
    return "Kamu ga punya akses buat kelola content calendar.";
  }
  return null;
}

export async function addContent(formData: {
  title: string;
  platform: string;
  scheduledDate: string;
  notes: string;
  imageUrl: string;
}) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

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
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("content_calendar")
    .update({ status })
    .eq("id", id);

  if (error) return { success: false, message: error.message };
  revalidatePath("/content-calendar");
  return { success: true, message: "Status konten diperbarui." };
}
