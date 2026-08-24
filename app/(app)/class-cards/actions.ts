"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CLASS_DAYS, DEFAULT_GOAL_TAGS } from "@/lib/classCards";
import {
  CommissionTier,
  DEFAULT_COMMISSION_TIERS,
  computeCommission,
} from "@/lib/commission";

async function getCallerContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("roles, teacher_id, student_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!myProfile) return null;
  return {
    roles: (myProfile.roles || []) as string[],
    teacherId: myProfile.teacher_id as string | null,
    studentId: myProfile.student_id as string | null,
    fullName: myProfile.full_name as string | null,
  };
}

type ClassCardInput = {
  name: string;
  description: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  capacityMax: string;
  isPrivate: boolean;
  registrationStart: string;
  registrationEnd: string;
  price: string;
  sessionsCount: string;
  goalTags: string[];
};

function validateInput(input: ClassCardInput): string | null {
  if (!input.name.trim()) return "Nama kelas wajib diisi.";
  if (input.dayOfWeek && !CLASS_DAYS.includes(input.dayOfWeek)) {
    return "Hari tidak valid.";
  }
  const capacity = Number(input.capacityMax) || 0;
  if (capacity < 1) return "Kuota kelas minimal 1 murid.";
  if (
    input.registrationStart &&
    input.registrationEnd &&
    input.registrationStart > input.registrationEnd
  ) {
    return "Tanggal mulai pendaftaran ga boleh lebih besar dari tanggal tutup.";
  }
  return null;
}

// Catatan/saran otomatis buat Owner pas nge-review kartu kelas -- BUKAN
// panggilan ke AI model beneran (biar ga nambah biaya/API key baru),
// tapi heuristik sederhana yang cek hal-hal yang biasanya perlu
// diperhatiin Owner sebelum approve.
function buildAiNote(
  input: ClassCardInput,
  capacity: number,
  price: number,
  avgPrice: number | null
): string {
  const notes: string[] = [];

  if (avgPrice && price > 0) {
    const diffPct = Math.round(((price - avgPrice) / avgPrice) * 100);
    if (diffPct >= 25) {
      notes.push(
        `Harga ${diffPct}% lebih tinggi dari rata-rata kelas lain (≈ Rp ${Math.round(
          avgPrice
        ).toLocaleString("id-ID")}).`
      );
    } else if (diffPct <= -25) {
      notes.push(
        `Harga ${Math.abs(diffPct)}% lebih rendah dari rata-rata kelas lain (≈ Rp ${Math.round(
          avgPrice
        ).toLocaleString("id-ID")}).`
      );
    }
  }

  if (input.isPrivate && capacity > 2) {
    notes.push(
      `Ditandai kelas privat tapi kuotanya ${capacity} murid -- cek lagi apa maksudnya emang privat.`
    );
  }

  if (!input.registrationStart || !input.registrationEnd) {
    notes.push("Periode pendaftaran belum diisi lengkap.");
  }

  if (input.goalTags.length === 0) {
    notes.push(
      "Belum ada tujuan belajar (HSK/dll) dipilih -- Murid bakal lebih susah nemuin kelas ini lewat filter tujuan."
    );
  }

  if (!input.description.trim()) {
    notes.push("Belum ada deskripsi kelas.");
  }

  if (notes.length === 0) return "Kartu kelas lengkap, ga ada catatan khusus.";
  return notes.map((n) => `• ${n}`).join("\n");
}

async function nextClassCode(supabase: Awaited<ReturnType<typeof createClient>>) {
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
  return `K${String(nextNumber).padStart(3, "0")}`;
}

// Laoshi bikin & submit kartu kelas baru -- langsung berstatus PENDING,
// nunggu di-approve Owner sebelum keliatan di Classes (Admin) & bisa
// dipilih Murid.
export async function submitClassCard(input: ClassCardInput) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("TEACHER") || !ctx.teacherId) {
    return {
      success: false,
      message: "Cuma akun Laoshi yang terhubung ke data Laoshi yang bisa bikin kelas.",
    };
  }

  const err = validateInput(input);
  if (err) return { success: false, message: err };

  const supabase = await createClient();
  const capacity = Number(input.capacityMax) || 1;
  const price = Number(input.price) || 0;

  const { data: approvedPrices } = await supabase
    .from("classes")
    .select("price")
    .eq("approval_status", "APPROVED")
    .not("price", "is", null);
  const prices = (approvedPrices ?? [])
    .map((c) => c.price as number)
    .filter((p) => typeof p === "number" && p > 0);
  const avgPrice =
    prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

  const classCode = await nextClassCode(supabase);

  const { error } = await supabase.from("classes").insert({
    class_code: classCode,
    name: input.name.trim(),
    description: input.description.trim() || null,
    teacher_id: ctx.teacherId,
    teacher_name: ctx.fullName,
    created_by_teacher_id: ctx.teacherId,
    day_of_week: input.dayOfWeek || null,
    start_time: input.startTime || null,
    end_time: input.endTime || null,
    capacity_max: capacity,
    is_private: input.isPrivate,
    registration_start: input.registrationStart || null,
    registration_end: input.registrationEnd || null,
    price: price || null,
    sessions_count: Number(input.sessionsCount) || null,
    goal_tags: input.goalTags,
    approval_status: "PENDING",
    active: false,
    registration_open: false,
    ai_note: buildAiNote(input, capacity, price, avgPrice),
  });

  if (error) return { success: false, message: error.message };

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Kartu kelas dikirim, nunggu di-approve Owner." };
}

// Laoshi edit ulang kartu yang di-REJECT (atau masih PENDING) &
// submit ulang -- balik ke status PENDING lagi.
export async function resubmitClassCard(id: string, input: ClassCardInput) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("TEACHER") || !ctx.teacherId) {
    return { success: false, message: "Kamu ga punya akses." };
  }

  const err = validateInput(input);
  if (err) return { success: false, message: err };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("classes")
    .select("id, created_by_teacher_id, approval_status")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return { success: false, message: "Kartu kelas tidak ditemukan." };
  if (existing.created_by_teacher_id !== ctx.teacherId) {
    return { success: false, message: "Ini bukan kartu kelas kamu." };
  }
  if (existing.approval_status === "APPROVED") {
    return {
      success: false,
      message: "Kelas yang udah di-approve ga bisa diedit dari sini lagi.",
    };
  }

  const capacity = Number(input.capacityMax) || 1;
  const price = Number(input.price) || 0;

  const { data: approvedPrices } = await supabase
    .from("classes")
    .select("price")
    .eq("approval_status", "APPROVED")
    .not("price", "is", null);
  const prices = (approvedPrices ?? [])
    .map((c) => c.price as number)
    .filter((p) => typeof p === "number" && p > 0);
  const avgPrice =
    prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

  const { error } = await supabase
    .from("classes")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      day_of_week: input.dayOfWeek || null,
      start_time: input.startTime || null,
      end_time: input.endTime || null,
      capacity_max: capacity,
      is_private: input.isPrivate,
      registration_start: input.registrationStart || null,
      registration_end: input.registrationEnd || null,
      price: price || null,
      sessions_count: Number(input.sessionsCount) || null,
      goal_tags: input.goalTags,
      approval_status: "PENDING",
      rejection_note: null,
      ai_note: buildAiNote(input, capacity, price, avgPrice),
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Kartu kelas dikirim ulang, nunggu di-approve Owner." };
}

// Owner approve kartu kelas -- baru dari sini kelasnya AKTIF, muncul di
// halaman Classes (Admin), dan bisa dipilih Murid (kalau ga privat &
// masih dalam periode pendaftaran).
export async function approveClassCard(id: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("OWNER")) {
    return { success: false, message: "Cuma Owner yang bisa approve kelas." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .update({
      approval_status: "APPROVED",
      active: true,
      registration_open: true,
      rejection_note: null,
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/class-cards", "layout");
  revalidatePath("/classes");
  return { success: true, message: "Kelas di-approve & sekarang tayang buat Murid." };
}

// Owner reject kartu kelas -- wajib kasih alasan biar Laoshi tau apa
// yang perlu diperbaiki sebelum submit ulang.
export async function rejectClassCard(id: string, note: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("OWNER")) {
    return { success: false, message: "Cuma Owner yang bisa reject kelas." };
  }
  if (!note.trim()) {
    return { success: false, message: "Alasan reject wajib diisi." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .update({
      approval_status: "REJECTED",
      active: false,
      registration_open: false,
      rejection_note: note.trim(),
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Kelas di-reject, Laoshi bakal lihat alasannya." };
}

// Murid join kelas lewat kartu -- first come first served, dibatasin
// kuota & periode pendaftaran. Buat v1: cuma Murid yang BELUM punya
// kelas aktif yang bisa self-join (biar ga kesenggol pindah kelas
// otomatis) -- kalau udah ada kelas, arahin ke Admin buat pindah kelas.
export async function joinClassCard(classId: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("STUDENT") || !ctx.studentId) {
    return {
      success: false,
      message: "Cuma akun Murid yang terhubung ke data Murid yang bisa join kelas.",
    };
  }

  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("id, class_id")
    .eq("id", ctx.studentId)
    .maybeSingle();

  if (!student) return { success: false, message: "Data murid tidak ditemukan." };
  if (student.class_id) {
    return {
      success: false,
      message:
        "Kamu udah terdaftar di kelas lain. Hubungi Admin kalau mau pindah kelas.",
    };
  }

  const { data: cls } = await supabase
    .from("classes")
    .select(
      "id, class_code, name, teacher_id, teacher_name, capacity_max, approval_status, active, is_private, registration_start, registration_end"
    )
    .eq("id", classId)
    .maybeSingle();

  if (!cls) return { success: false, message: "Kelas tidak ditemukan." };
  if (cls.approval_status !== "APPROVED" || !cls.active) {
    return { success: false, message: "Kelas ini belum/ga bisa dijoin." };
  }
  if (cls.is_private) {
    return {
      success: false,
      message: "Kelas privat -- daftarnya lewat Admin/Laoshi langsung.",
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (cls.registration_start && today < cls.registration_start) {
    return { success: false, message: "Pendaftaran kelas ini belum dibuka." };
  }
  if (cls.registration_end && today > cls.registration_end) {
    return { success: false, message: "Pendaftaran kelas ini udah ditutup." };
  }

  const { count } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("class_id", cls.id);

  if ((count ?? 0) >= cls.capacity_max) {
    return { success: false, message: "Kelas ini udah penuh." };
  }

  const { error: updateError } = await supabase
    .from("students")
    .update({
      class_id: cls.id,
      class_name: cls.name,
      teacher_name: cls.teacher_name,
    })
    .eq("id", student.id);

  if (updateError) return { success: false, message: updateError.message };

  const { data: last } = await supabase
    .from("enrollments")
    .select("enrollment_code")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextNumber = 1;
  if (last?.enrollment_code) {
    const match = last.enrollment_code.match(/\d+/);
    if (match) nextNumber = parseInt(match[0], 10) + 1;
  }
  const enrollmentCode = `ENR${String(nextNumber).padStart(5, "0")}`;

  await supabase.from("enrollments").insert({
    enrollment_code: enrollmentCode,
    student_id: student.id,
    class_id: cls.id,
    status: "ACTIVE",
  });

  revalidatePath("/class-cards", "layout");
  revalidatePath("/", "layout");
  return { success: true, message: `Berhasil join ${cls.name}!` };
}

export async function getCommissionTiers(): Promise<CommissionTier[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("commission_tiers")
    .eq("id", 1)
    .maybeSingle();
  const tiers = data?.commission_tiers as CommissionTier[] | null;
  return tiers && tiers.length > 0 ? tiers : DEFAULT_COMMISSION_TIERS;
}

export async function saveCommissionTiers(tiers: CommissionTier[]) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("OWNER")) {
    return { success: false, message: "Cuma Owner yang bisa atur potongan komisi." };
  }

  const cleaned = tiers
    .map((t) => ({
      maxPrice: t.maxPrice === null ? null : Number(t.maxPrice) || 0,
      pct: Number(t.pct) || 0,
    }))
    .filter((t) => t.pct >= 0 && t.pct <= 100);

  if (cleaned.length === 0) {
    return { success: false, message: "Minimal 1 tier komisi." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, commission_tiers: cleaned });

  if (error) return { success: false, message: error.message };

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Pengaturan potongan komisi disimpan." };
}

// Katalog badge "Tujuan Belajar" (HSK, China Buddy, dll) yang bisa
// dipilih Laoshi pas bikin kartu kelas -- diatur Owner sendiri.
export async function getGoalTags(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("goal_tags")
    .eq("id", 1)
    .maybeSingle();
  const tags = data?.goal_tags as string[] | null;
  return tags && tags.length > 0 ? tags : DEFAULT_GOAL_TAGS;
}

export async function saveGoalTags(tags: string[]) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("OWNER")) {
    return { success: false, message: "Cuma Owner yang bisa atur tujuan belajar." };
  }

  const cleaned = Array.from(
    new Set(tags.map((t) => t.trim()).filter((t) => t.length > 0))
  );
  if (cleaned.length === 0) {
    return { success: false, message: "Minimal 1 tujuan belajar." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, goal_tags: cleaned });

  if (error) return { success: false, message: error.message };

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Daftar tujuan belajar disimpan." };
}

// Link kuisioner pendaftaran murid baru (Google Form) -- diatur Owner,
// ditampilin ke calon murid biar mereka isi dulu sebelum pilih kelas di
// Class Card, biar keliatan tujuan belajarnya apa & bisa diarahkan ke
// kelas yang cocok.
export async function getRegistrationFormUrl(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("registration_form_url")
    .eq("id", 1)
    .maybeSingle();
  return data?.registration_form_url ?? null;
}

export async function saveRegistrationFormUrl(url: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("OWNER")) {
    return { success: false, message: "Cuma Owner yang bisa atur link kuisioner." };
  }

  const trimmed = url.trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    return { success: false, message: "Link harus diawali http:// atau https://" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, registration_form_url: trimmed || null });

  if (error) return { success: false, message: error.message };

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Link kuisioner disimpan." };
}

export { computeCommission };
