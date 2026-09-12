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

// Cuma Owner/Admin yang boleh generate/kelola jadwal mingguan. Laoshi/Murid
// liat jadwal mereka sendiri lewat halaman "my-schedule" (route terpisah).
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
    return "Kamu ga punya akses buat kelola jadwal.";
  }
  return null;
}

type ClassRow = {
  id: string;
  name: string;
  teacher_name: string | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  start_date: string | null;
};

// Inti logika generate sesi -- dipakai bareng oleh generateUpcomingSessions
// (tombol manual Owner/Admin, jalan buat SEMUA kelas aktif) dan
// generateSessionsForClass (dipanggil otomatis pas 1 kelas di-approve,
// lihat class-cards/actions.ts). Idempotent -- sesi yang udah ada
// (class_id + tanggal yang sama) dilewatin, ga dobel.
//
// Kalau kelasnya punya start_date, sesi ga di-generate buat tanggal
// SEBELUM start_date itu -- kelas belum jalan, jadi belum perlu muncul
// di jadwal.
async function generateSessionsForClasses(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classes: ClassRow[],
  daysAhead: number
) {
  if (classes.length === 0) {
    return { success: true, message: "Belum ada kelas dengan hari terjadwal.", count: 0 };
  }

  const classIds = classes.map((c) => c.id);
  const { data: existingSessions } = await supabase
    .from("sessions")
    .select("class_id, session_date")
    .in("class_id", classIds);

  const existingKeys = new Set(
    (existingSessions ?? []).map((s) => `${s.class_id}_${s.session_date}`)
  );

  const rowsToInsert: {
    session_code: string;
    class_id: string;
    class_name: string;
    teacher_planned: string | null;
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
      if (cls.start_date && dateStr < cls.start_date) continue;

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
    return {
      success: true,
      message: "Semua sesi sudah ter-generate, tidak ada yang baru.",
      count: 0,
    };
  }

  const { error } = await supabase.from("sessions").insert(rowsToInsert);
  if (error) return { success: false, message: error.message, count: 0 };

  return {
    success: true,
    message: `${rowsToInsert.length} sesi baru berhasil di-generate.`,
    count: rowsToInsert.length,
  };
}

/**
 * Generate Session (baris bertanggal) dari pola kelas berulang
 * (classes.day_of_week) buat N hari ke depan, buat SEMUA kelas aktif.
 * Idempotent -- kalau sesi buat kelas+tanggal itu udah ada, dilewatin
 * (nggak dobel). Dipanggil Owner/Admin lewat tombol di halaman Weekly
 * Schedule -- berguna buat kelas lama yang sesi-nya belum ke-generate,
 * atau buat nambah sesi lebih jauh ke depan.
 */
export async function generateUpcomingSessions(daysAhead: number = 60) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, teacher_name, day_of_week, start_time, end_time, start_date")
    .eq("active", true)
    .not("day_of_week", "is", null);

  const result = await generateSessionsForClasses(
    supabase,
    (classes ?? []) as ClassRow[],
    daysAhead
  );

  if (result.success) {
    revalidatePath("/weekly-schedule");
  }
  return { success: result.success, message: result.message };
}

// Generate sesi buat SATU kelas aja -- dipanggil otomatis dari
// approveClassCard tiap kali Owner approve Class Card, biar begitu
// disetujui langsung muncul di Weekly Schedule (Laoshi/Owner/Admin) &
// jadwal Murid yang join, tanpa Owner/Admin harus inget klik "Generate
// Sessions" manual lagi. TIDAK ada requireStaff() di sini (bukan dipanggil
// langsung dari UI) -- pemanggilnya (approveClassCard) udah ngecek Owner
// duluan.
export async function generateSessionsForClass(classId: string, daysAhead = 90) {
  const supabase = await createClient();
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, teacher_name, day_of_week, start_time, end_time, start_date")
    .eq("id", classId)
    .maybeSingle();

  if (!cls || !cls.day_of_week) return;

  const result = await generateSessionsForClasses(supabase, [cls as ClassRow], daysAhead);
  if (result.success && result.count > 0) {
    revalidatePath("/weekly-schedule");
    revalidatePath("/my-schedule");
  }
}
