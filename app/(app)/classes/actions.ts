"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendWhatsApp, normalizePhone } from "@/lib/fonnte";
import { recordNotificationFailure } from "@/lib/notifyFailure";

const DAYS = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

// Cuma Owner/Admin yang boleh kelola data kelas (jadwal, kapasitas,
// laoshi pengampu, dsb).
async function requireStaff(): Promise<string | null> {
  const profile = await getCurrentProfile();

  if (!profile) return "Belum login.";

  const myRoles = profile.roles;
  if (!myRoles.includes("OWNER") && !myRoles.includes("ADMIN")) {
    return "Kamu enggak punya akses buat kelola data kelas.";
  }
  return null;
}

export async function updateClass(
  id: string,
  formData: {
    name: string;
    teacherId: string;
    teacherName: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    capacityMax: string;
    active: boolean;
    waGroupId: string;
  }
) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  if (formData.dayOfWeek && !DAYS.includes(formData.dayOfWeek)) {
    return { success: false, message: "Hari tidak valid." };
  }

  const { data: before } = await supabase
    .from("classes")
    .select("name, day_of_week, start_time, end_time, teacher_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("classes")
    .update({
      name: formData.name,
      teacher_id: formData.teacherId || null,
      teacher_name: formData.teacherName || null,
      day_of_week: formData.dayOfWeek || null,
      start_time: formData.startTime || null,
      end_time: formData.endTime || null,
      capacity_max: Number(formData.capacityMax) || 6,
      active: formData.active,
      wa_group_id: formData.waGroupId || null,
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  // Kabarin Laoshi & Murid kelas ini lewat WhatsApp kalau jadwalnya
  // (hari/jam) beneran berubah -- perubahan lain (nama, kuota, dll) ga
  // perlu notif WA, cuma yang jadwal soalnya itu yang bikin orang bisa
  // salah datang.
  const scheduleChanged =
    !!before &&
    (before.day_of_week !== (formData.dayOfWeek || null) ||
      before.start_time !== (formData.startTime || null) ||
      before.end_time !== (formData.endTime || null));

  if (scheduleChanged) {
    await notifyClassScheduleChanged(id, formData.name, formData.dayOfWeek, formData.startTime, formData.endTime);
  }

  revalidatePath("/classes");
  return { success: true, message: "Data kelas berhasil diperbarui." };
}

// Kabarin Laoshi pengajar kelas ini + semua Murid aktif di kelas ini
// lewat WhatsApp begitu jadwal (hari/jam) kelasnya berubah. Best effort
// -- gagal kirim ke satu orang ga bikin proses update kelasnya gagal.
async function notifyClassScheduleChanged(
  classId: string,
  className: string,
  dayOfWeek: string,
  startTime: string,
  endTime: string
) {
  const supabase = await createClient();
  const scheduleText =
    dayOfWeek && startTime && endTime
      ? `${dayOfWeek}, ${startTime}-${endTime}`
      : "belum diatur lagi";
  const msg = `📅 Jadwal kelas "${className}" berubah jadi ${scheduleText}. Cek jadwal terbaru kamu ya.`;

  const [{ data: cls }, { data: students }] = await Promise.all([
    supabase.from("classes").select("teacher_id").eq("id", classId).maybeSingle(),
    supabase.from("students").select("name, phone").eq("class_id", classId),
  ]);

  if (cls?.teacher_id) {
    const { data: teacher } = await supabase
      .from("teachers")
      .select("name, phone")
      .eq("id", cls.teacher_id)
      .maybeSingle();
    if (teacher?.phone) {
      try {
        const result = await sendWhatsApp(normalizePhone(teacher.phone), msg);
        if (!result.success) {
          await recordNotificationFailure(
            `Gagal kirim notif "jadwal kelas berubah" ke Laoshi ${teacher.name || "-"} (${teacher.phone}) buat kelas "${className}". Alasan: ${result.reason || "tidak diketahui"}.`
          );
        }
      } catch (err) {
        await recordNotificationFailure(
          `Gagal kirim notif "jadwal kelas berubah" ke Laoshi ${teacher.name || "-"} (${teacher.phone}) buat kelas "${className}". Error: ${err instanceof Error ? err.message : String(err)}.`
        );
      }
    }
  }

  for (const s of students ?? []) {
    if (!s.phone) continue;
    try {
      const result = await sendWhatsApp(normalizePhone(s.phone), msg);
      if (!result.success) {
        await recordNotificationFailure(
          `Gagal kirim notif "jadwal kelas berubah" ke Murid ${s.name || "-"} (${s.phone}) buat kelas "${className}". Alasan: ${result.reason || "tidak diketahui"}.`
        );
      }
    } catch (err) {
      await recordNotificationFailure(
        `Gagal kirim notif "jadwal kelas berubah" ke Murid ${s.name || "-"} (${s.phone}) buat kelas "${className}". Error: ${err instanceof Error ? err.message : String(err)}.`
      );
    }
  }
}

export async function addClass(formData: {
  name: string;
  teacherId: string;
  teacherName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  capacityMax: string;
}) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  if (formData.dayOfWeek && !DAYS.includes(formData.dayOfWeek)) {
    return { success: false, message: "Hari tidak valid." };
  }

  const { data: last } = await supabase
    .from("classes")
    .select("class_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (last?.class_code) {
    const match = last.class_code.match(/\d+/);
    if (match) nextNumber = parseInt(match[0], 10) + 1;
  }
  const classCode = `K${String(nextNumber).padStart(3, "0")}`;

  const { error } = await supabase.from("classes").insert({
    class_code: classCode,
    name: formData.name,
    teacher_id: formData.teacherId || null,
    teacher_name: formData.teacherName || null,
    day_of_week: formData.dayOfWeek || null,
    start_time: formData.startTime || null,
    end_time: formData.endTime || null,
    capacity_max: Number(formData.capacityMax) || 6,
    active: true,
    registration_open: true,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/classes");
  return { success: true, message: "Kelas berhasil ditambahkan." };
}
