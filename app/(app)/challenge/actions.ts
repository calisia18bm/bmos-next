"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ============================================================
// Challenge 30 Hari + Kosakata -- server actions
//
// Aturan hari & freeze (v2):
// - current_day MAJU TERUS tiap hari kalender, ga peduli hari
//   sebelumnya udah dikerjain apa belum (Day 5 -> besok otomatis
//   Day 6, bukan nunggu Day 5 kelar dulu).
// - Kalau 1 hari kelewat (ga sempet dapet cap), hari itu jadi
//   "frozen_day" -- MASIH BISA DIKEJAR belakangan, selama masih
//   dalam batas waktu (frozen_day_deadline).
// - Kalau frozen_day itu ga sempet dikejar sebelum deadline lewat
//   (kelewat 1 hari lagi tanpa nyelesaiinnya), progress RESET ke
//   Day 1.
// - Begitu frozen_day berhasil dikejar, freeze langsung tersedia
//   lagi buat dipake kalau ada hari lain kelewat lagi nanti.
//
// Skor test kosakata (10/10 wajib) dipercaya dari client -- ini
// pola yang sama kayak placement_test_results (skor dihitung &
// dikirim dari sisi client), bukan pola baru.
// ============================================================

// Pake getCurrentProfile() (di-cache per request di lib/auth.ts) --
// biar ga nembak auth.getUser() + query user_profiles sendiri lagi
// padahal datanya sama persis kayak yang udah diambil di tempat lain
// dalam request yang sama (misal app/(app)/layout.tsx).
async function getCallerContext() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  return {
    roles: profile.roles,
    teacherId: profile.teacher_id,
    studentId: profile.student_id,
    fullName: profile.full_name,
  };
}

function isStaffRoles(roles: string[]) {
  return roles.includes("OWNER") || roles.includes("ADMIN");
}

function daysBetween(a: string, b: string) {
  // a, b format 'YYYY-MM-DD'
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Pastiin murid punya baris vocab_progress, dan majuin current_day
// sesuai kalender + selesaiin resolusi freeze/reset SEBELUM data
// hari ini dikasih ke client. Dipanggil tiap kali halaman Challenge
// dibuka (bukan cuma pas submit), jadi hari selalu update walau
// murid ga buka app tiap hari.
async function resolveStreak(studentId: string) {
  const supabase = await createClient();

  let { data: progress } = await supabase
    .from("vocab_progress")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  if (!progress) {
    const { data: created } = await supabase
      .from("vocab_progress")
      .insert({ student_id: studentId })
      .select("*")
      .single();
    progress = created;
  }
  if (!progress) return null;

  const today = todayStr();
  const elapsedDay = Math.min(daysBetween(progress.started_at, today) + 1, 31);
  const newDays = elapsedDay - progress.current_day;

  if (newDays <= 0) {
    return progress; // masih di hari kalender yang sama, ga ada yg berubah
  }

  // -- Ada frozen_day yang lagi nunggu dikejar --
  if (progress.frozen_day) {
    if (progress.frozen_day_deadline && today > progress.frozen_day_deadline) {
      // Ga sempet dikejar sebelum deadline -> reset total.
      const { data: reset } = await supabase
        .from("vocab_progress")
        .update({
          current_day: 1,
          started_at: today,
          freeze_available: true,
          frozen_day: null,
          frozen_day_deadline: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", progress.id)
        .select("*")
        .single();
      return reset || progress;
    }
    // Masih dalam batas waktu -- lanjut maju, frozen_day tetep nunggu.
    const { data: advanced } = await supabase
      .from("vocab_progress")
      .update({ current_day: elapsedDay, updated_at: new Date().toISOString() })
      .eq("id", progress.id)
      .select("*")
      .single();
    return advanced || progress;
  }

  // -- Ga ada frozen_day pending -- cek apakah hari yg baru lewat
  //    (current_day yang lama) itu udah dapet cap atau belum.
  const oldDay = progress.current_day;
  const { data: oldDayLog } = await supabase
    .from("vocab_day_logs")
    .select("id")
    .eq("student_id", studentId)
    .eq("day_number", oldDay)
    .maybeSingle();

  if (oldDayLog || newDays > 1) {
    // Kalau udah dikerjain -> aman, lanjut biasa.
    // Kalau lompat >=2 hari sekaligus (ga buka app berhari-hari) ->
    // kelewat kegedean, langsung reset (freeze cuma nolongin 1 hari).
    if (!oldDayLog && newDays > 1) {
      const { data: reset } = await supabase
        .from("vocab_progress")
        .update({
          current_day: 1,
          started_at: today,
          freeze_available: true,
          frozen_day: null,
          frozen_day_deadline: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", progress.id)
        .select("*")
        .single();
      return reset || progress;
    }
    const { data: advanced } = await supabase
      .from("vocab_progress")
      .update({ current_day: elapsedDay, updated_at: new Date().toISOString() })
      .eq("id", progress.id)
      .select("*")
      .single();
    return advanced || progress;
  }

  // Persis kelewat 1 hari (oldDay ga dikerjain, newDays === 1).
  if (progress.freeze_available) {
    // Freeze dipake: oldDay jadi frozen_day, msh bisa dikejar sampai
    // akhir hari ini (kalau lewat lagi 1 hari tanpa dikejar -> reset).
    const { data: frozen } = await supabase
      .from("vocab_progress")
      .update({
        current_day: elapsedDay,
        freeze_available: false,
        frozen_day: oldDay,
        frozen_day_deadline: today,
        updated_at: new Date().toISOString(),
      })
      .eq("id", progress.id)
      .select("*")
      .single();
    return frozen || progress;
  }

  // Freeze udah kepake sebelumnya dan kelewat lagi -> reset.
  const { data: reset } = await supabase
    .from("vocab_progress")
    .update({
      current_day: 1,
      started_at: today,
      freeze_available: true,
      frozen_day: null,
      frozen_day_deadline: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", progress.id)
    .select("*")
    .single();
  return reset || progress;
}

async function fetchWordsForDay(level: string, dayNumber: number) {
  const supabase = await createClient();
  const from = (dayNumber - 1) * 10;
  const { data: words } = await supabase
    .from("vocab_words")
    .select("id, hanzi, pinyin, arti, audio_url, order_index")
    .eq("level", level)
    .eq("active", true)
    .order("order_index", { ascending: true })
    .range(from, from + 9);
  return words || [];
}

// Owner/Admin buka /challenge buat preview tampilan Murid (akun mereka
// sendiri ga punya progress beneran) -- selalu nampilin Hari 1, ga ada
// freeze/frozen_day, submit-nya dimatiin di sisi UI (prop `disabled`).
export async function getPreviewChallenge(level: "DASAR" | "MENENGAH") {
  const ctx = await getCallerContext();
  if (!ctx || !isStaffRoles(ctx.roles)) {
    return { success: false, message: "Ga punya akses." };
  }

  const words = await fetchWordsForDay(level, 1);
  if (words.length === 0) {
    return {
      success: false,
      message: `Belum ada kosakata level ${level}. Tambahin dulu lewat halaman Challenge & Kosakata.`,
    };
  }

  return {
    success: true,
    finished: false,
    student: { name: "Preview", level },
    progress: { current_day: 1, freeze_available: true },
    alreadyDoneToday: false,
    words,
    frozenDay: null,
    frozenDayDeadline: null,
    frozenWords: [] as { id: string; hanzi: string; pinyin: string; arti: string; audio_url: string | null }[],
  };
}

// Murid buka halaman Challenge -- dapetin kata hari ini (+ kata hari
// yang lagi dikejar via freeze, kalau ada) + status progress.
export async function getTodayChallenge() {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("STUDENT") || !ctx.studentId) {
    return { success: false, message: "Cuma akun Murid yang punya Challenge 30 Hari." };
  }

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id, name, level")
    .eq("id", ctx.studentId)
    .maybeSingle();
  if (!student) return { success: false, message: "Data murid tidak ditemukan." };

  const progress = await resolveStreak(ctx.studentId);
  if (!progress) return { success: false, message: "Gagal memuat progress challenge." };

  if (progress.current_day > 30) {
    return { success: true, finished: true, progress, words: [], frozenWords: [] };
  }

  const { data: alreadyDone } = await supabase
    .from("vocab_day_logs")
    .select("id")
    .eq("student_id", ctx.studentId)
    .eq("day_number", progress.current_day)
    .maybeSingle();

  const words = await fetchWordsForDay(student.level, progress.current_day);
  const frozenWords = progress.frozen_day
    ? await fetchWordsForDay(student.level, progress.frozen_day)
    : [];

  return {
    success: true,
    finished: false,
    student: { name: student.name, level: student.level },
    progress,
    alreadyDoneToday: !!alreadyDone,
    words,
    frozenDay: progress.frozen_day,
    frozenDayDeadline: progress.frozen_day_deadline,
    frozenWords,
  };
}

// Murid submit hasil test 10 soal -- dayNumber boleh current_day
// ATAU frozen_day (buat nyusul hari yg kelewat). Cuma dianggap
// lulus & dapet cap kalau score === totalQuestions === 10.
export async function submitDayTest(input: {
  dayNumber: number;
  score: number;
  totalQuestions: number;
  diaryNote?: string;
  diaryAttachmentUrl?: string;
  diaryAttachmentType?: "IMAGE" | "AUDIO" | "VIDEO";
}) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("STUDENT") || !ctx.studentId) {
    return { success: false, message: "Cuma akun Murid yang bisa submit test." };
  }

  if (input.totalQuestions !== 10 || input.score !== 10) {
    return {
      success: false,
      passed: false,
      message: `Belum sempurna (${input.score}/${input.totalQuestions}). Coba lagi ya, ga ada batas percobaan.`,
    };
  }

  const supabase = await createClient();
  const progress = await resolveStreak(ctx.studentId);
  if (!progress) return { success: false, message: "Gagal memuat progress challenge." };

  const isCatchUpFrozenDay = progress.frozen_day === input.dayNumber;
  const isTodayDay = progress.current_day === input.dayNumber;
  if (!isCatchUpFrozenDay && !isTodayDay) {
    return {
      success: false,
      message: "Data hari challenge udah berubah, refresh halaman dulu ya.",
    };
  }

  const { data: existing } = await supabase
    .from("vocab_day_logs")
    .select("id")
    .eq("student_id", ctx.studentId)
    .eq("day_number", input.dayNumber)
    .maybeSingle();
  if (existing) {
    return { success: false, message: "Hari ini udah pernah dapet cap." };
  }

  const { error: logError } = await supabase.from("vocab_day_logs").insert({
    student_id: ctx.studentId,
    day_number: input.dayNumber,
    used_freeze: isCatchUpFrozenDay,
    diary_note: input.diaryNote || null,
    diary_attachment_url: input.diaryAttachmentUrl || null,
    diary_attachment_type: input.diaryAttachmentType || null,
  });
  if (logError) return { success: false, message: logError.message };

  if (isCatchUpFrozenDay) {
    // Berhasil nyusul -- freeze langsung tersedia lagi.
    const { error: progError } = await supabase
      .from("vocab_progress")
      .update({
        frozen_day: null,
        frozen_day_deadline: null,
        freeze_available: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", progress.id);
    if (progError) return { success: false, message: progError.message };
  }
  // Kalau ini hari yang lagi aktif (current_day), current_day-nya
  // SENDIRI ga perlu diubah di sini -- dia emang udah maju otomatis
  // via resolveStreak berdasarkan kalender, cap ini cuma nyatetin
  // bahwa hari itu berhasil diselesaikan.

  revalidatePath("/challenge", "layout");
  revalidatePath("/", "layout");
  return {
    success: true,
    passed: true,
    message: isCatchUpFrozenDay
      ? `Berhasil nyusul cap Hari ${input.dayNumber}! Freeze kamu balik lagi.`
      : `Cap Hari ${input.dayNumber} berhasil didapat!`,
  };
}

// ------------------------------------------------------------
// Admin -- kelola bank kosakata
// ------------------------------------------------------------
export async function listVocabWords(level: "DASAR" | "MENENGAH") {
  const ctx = await getCallerContext();
  if (!ctx || !isStaffRoles(ctx.roles)) return { success: false, message: "Ga punya akses." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vocab_words")
    .select("*")
    .eq("level", level)
    .order("order_index", { ascending: true });
  if (error) return { success: false, message: error.message };
  return { success: true, words: data || [] };
}

export async function addVocabWord(input: {
  level: "DASAR" | "MENENGAH";
  hanzi: string;
  pinyin: string;
  arti: string;
  audioUrl?: string;
  orderIndex: number;
}) {
  const ctx = await getCallerContext();
  if (!ctx || !isStaffRoles(ctx.roles)) return { success: false, message: "Ga punya akses." };
  if (!input.hanzi.trim() || !input.pinyin.trim() || !input.arti.trim()) {
    return { success: false, message: "Hanzi, pinyin, dan arti wajib diisi." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vocab_words").insert({
    level: input.level,
    hanzi: input.hanzi.trim(),
    pinyin: input.pinyin.trim(),
    arti: input.arti.trim(),
    audio_url: input.audioUrl || null,
    order_index: input.orderIndex,
  });
  if (error) return { success: false, message: error.message };

  revalidatePath("/admin/vocab", "layout");
  return { success: true, message: "Kosakata ditambahkan." };
}

export async function updateVocabWord(
  id: string,
  input: Partial<{
    hanzi: string;
    pinyin: string;
    arti: string;
    audioUrl: string;
    orderIndex: number;
    active: boolean;
  }>
) {
  const ctx = await getCallerContext();
  if (!ctx || !isStaffRoles(ctx.roles)) return { success: false, message: "Ga punya akses." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("vocab_words")
    .update({
      ...(input.hanzi !== undefined ? { hanzi: input.hanzi.trim() } : {}),
      ...(input.pinyin !== undefined ? { pinyin: input.pinyin.trim() } : {}),
      ...(input.arti !== undefined ? { arti: input.arti.trim() } : {}),
      ...(input.audioUrl !== undefined ? { audio_url: input.audioUrl || null } : {}),
      ...(input.orderIndex !== undefined ? { order_index: input.orderIndex } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    })
    .eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/admin/vocab", "layout");
  return { success: true, message: "Kosakata diupdate." };
}

export async function deleteVocabWord(id: string) {
  const ctx = await getCallerContext();
  if (!ctx || !isStaffRoles(ctx.roles)) return { success: false, message: "Ga punya akses." };

  const supabase = await createClient();
  const { error } = await supabase.from("vocab_words").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/admin/vocab", "layout");
  return { success: true, message: "Kosakata dihapus." };
}

// ------------------------------------------------------------
// Home dashboard -- murid mana yang belum ngerjain challenge hari
// ini, lagi pake freeze, atau kepepet mau reset.
// ------------------------------------------------------------
export async function getChallengeLaggards() {
  const ctx = await getCallerContext();
  if (!ctx || !isStaffRoles(ctx.roles)) return { success: false, message: "Ga punya akses." };

  const supabase = await createClient();
  const { data: progressRows } = await supabase
    .from("vocab_progress")
    .select("student_id, current_day, frozen_day, frozen_day_deadline, freeze_available");
  if (!progressRows) return { success: true, laggards: [] };

  const today = todayStr();

  const { data: todayLogs } = await supabase
    .from("vocab_day_logs")
    .select("student_id, day_number")
    .gte("completed_at", `${today}T00:00:00Z`);
  const doneTodaySet = new Set(
    (todayLogs || [])
      .filter((l) => progressRows.some((p) => p.student_id === l.student_id && p.current_day === l.day_number))
      .map((l) => l.student_id)
  );

  const laggards = progressRows.filter((p) => !doneTodaySet.has(p.student_id));
  if (laggards.length === 0) return { success: true, laggards: [] };

  const studentIds = laggards.map((p) => p.student_id);
  const { data: students } = await supabase
    .from("students")
    .select("id, name, level")
    .in("id", studentIds);
  const byId = new Map((students || []).map((s) => [s.id, s]));

  const result = laggards.map((p) => {
    let status: "BELUM_MULAI_HARI_INI" | "PAKE_FREEZE" | "TERANCAM_RESET" = "BELUM_MULAI_HARI_INI";
    if (p.frozen_day) {
      status = p.frozen_day_deadline === today ? "TERANCAM_RESET" : "PAKE_FREEZE";
    }

    const student = byId.get(p.student_id);
    return {
      studentId: p.student_id,
      name: student?.name || "(tidak diketahui)",
      level: student?.level || "DASAR",
      currentDay: p.current_day,
      frozenDay: p.frozen_day,
      status,
      reminderMessage: buildReminderMessage(student?.name || "Murid", p.current_day, p.frozen_day, status),
    };
  });

  return { success: true, laggards: result };
}

// Placeholder reminder generator -- template sederhana dulu; bisa
// disambungin ke provider AI beneran (misal buat variasi kalimat)
// tanpa ubah bentuk data yang dipakai UI.
function buildReminderMessage(
  name: string,
  currentDay: number,
  frozenDay: number | null,
  status: "BELUM_MULAI_HARI_INI" | "PAKE_FREEZE" | "TERANCAM_RESET"
) {
  if (status === "TERANCAM_RESET") {
    return `${name}, kejar cap Hari ${frozenDay} HARI INI juga, kalau nggak progress bakal reset ke Hari 1!`;
  }
  if (status === "PAKE_FREEZE") {
    return `${name}, kamu kelewat Hari ${frozenDay} kemarin (udah kepake freeze). Masih bisa dikejar sampai hari ini!`;
  }
  return `${name}, jangan lupa kerjain Challenge Hari ${currentDay} hari ini ya!`;
}
