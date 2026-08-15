"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function getMondayOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export async function confirmChoice(
  studentId: string,
  classGroupName: string,
  chosenClassId: string
) {
  const supabase = await createClient();
  const weekStart = getMondayOfWeek();

  const { error } = await supabase.from("weekly_choices").upsert(
    {
      student_id: studentId,
      class_group_name: classGroupName,
      chosen_class_id: chosenClassId,
      week_start: weekStart,
      confirmed: true,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: "student_id,class_group_name,week_start" }
  );

  if (error) return { success: false, message: error.message };

  revalidatePath("/weekly-choice");
  return { success: true, message: "Pilihan berhasil dikonfirmasi." };
}
