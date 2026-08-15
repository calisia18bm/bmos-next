"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const DAY_INDEX: Record<string, number> = {
  Minggu: 0,
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
};

/**
 * Generate Session (baris bertanggal) dari pola kelas berulang
 * (classes.day_of_week) buat N hari ke depan. Idempotent -- kalau
 * sesi buat kelas+tanggal itu udah ada, dilewatin (nggak dobel).
 */
export async function generateUpcomingSessions(daysAhead: number = 60) {
  const supabase = await createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("active", true)
    .not("day_of_week", "is", null);

  if (!classes || classes.length === 0) {
    return { success: false, message: "Belum ada kelas dengan hari terjadwal." };
  }

  const { data: existingSessions } = await supabase
    .from("sessions")
    .select("class_id, session_date");

  const existingKeys = new Set(
    (existingSessions ?? []).map((s) => `${s.class_id}_${s.session_date}`)
  );

  const rowsToInsert: {
    session_code: string;
    class_id: string;
    class_name: string;
    teacher_planned: string;
    session_date: string;
    start_time: string | null;
    end_time: string | null;
    status: string;
  }[] = [];

  let counter = Date.now();

  for (const cls of classes) {
    const targetDayIndex = DAY_INDEX[cls.day_of_week as string];
    if (targetDayIndex === undefined) continue;

    for (let i = 0; i < daysAhead; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      if (date.getDay() !== targetDayIndex) continue;

      const dateStr = date.toISOString().slice(0, 10);
      const key = `${cls.id}_${dateStr}`;
      if (existingKeys.has(key)) continue;

      counter++;
      rowsToInsert.push({
        session_code: `SES${counter}`,
        class_id: cls.id,
        class_name: cls.name,
        teacher_planned: cls.teacher_name,
        session_date: dateStr,
        start_time: cls.start_time,
        end_time: cls.end_time,
        status: "UPCOMING",
      });
    }
  }

  if (rowsToInsert.length === 0) {
    return { success: true, message: "Semua sesi sudah ter-generate, tidak ada yang baru." };
  }

  const { error } = await supabase.from("sessions").insert(rowsToInsert);

  if (error) return { success: false, message: error.message };

  revalidatePath("/weekly-schedule");
  return {
    success: true,
    message: `${rowsToInsert.length} sesi baru berhasil di-generate.`,
  };
}
