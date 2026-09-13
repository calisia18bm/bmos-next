"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { CLASS_DAYS, DEFAULT_GOAL_TAGS } from "@/lib/classCards";
import {
  CommissionTier,
  DEFAULT_COMMISSION_TIERS,
  computeCommission,
} from "@/lib/commission";
import { sendWhatsApp, normalizePhone } from "@/lib/fonnte";
import { recordNotificationFailure } from "@/lib/notifyFailure";
import { generateSessionsForClass } from "../weekly-schedule/actions";
import { SITE_URL } from "@/lib/site";

// Berapa banyak Class Card yang lagi PENDING (nunggu di-approve Owner) --
// dipakai buat badge notif di sidebar (menu "Approval Kelas") & buat
// widget "Need Attention" di Home. Cuma dihitung buat Owner/Admin (yang
// emang bisa approve) -- role lain selalu dapet 0.
export async function getPendingClassCardCount() {
  const ctx = await getCallerContext();
  if (!ctx) return 0;
  if (!ctx.roles.includes("OWNER") && !ctx.roles.includes("ADMIN")) return 0;

  const supabase = await createClient();
  const { count } = await supabase
    .from("classes")
    .select("*", { count: "exact", head: true })
    .eq("approval_status", "PENDING");

  return count ?? 0;
}

// Berapa banyak Class Card punya Laoshi sendiri yang statusnya baru aja
// di-approve/di-reject Owner TAPI belum sempat dibuka/dilihat Laoshi-nya
// -- dipakai buat badge notif angka di sidebar menu "Class Card" (grup
// LAOSHI). Cuma dihitung buat Teacher yang udah kehubung ke data Laoshi;
// role lain selalu dapet 0.
export async function getUnseenClassCardStatusCount() {
  const ctx = await getCallerContext();
  if (!ctx) return 0;
  if (!ctx.roles.includes("TEACHER") || !ctx.teacherId) return 0;

  const supabase = await createClient();
  const { data } = await supabase
    .from("classes")
    .select("status_updated_at, teacher_seen_status_at")
    .eq("created_by_teacher_id", ctx.teacherId)
    .in("approval_status", ["APPROVED", "REJECTED"]);

  const unseen = (data ?? []).filter((c) => {
    if (!c.teacher_seen_status_at) return true;
    return new Date(c.teacher_seen_status_at) < new Date(c.status_updated_at);
  });

  return unseen.length;
}

// Dipanggil dari halaman Class Card (sudut pandang Laoshi asli, bukan
// preview Owner) tiap kali Laoshi buka halamannya -- nandain SEMUA kartu
// kelas dia sendiri sebagai "udah dilihat" statusnya yang sekarang, biar
// badge notif & warna "baru" ilang buat kunjungan berikutnya.
export async function markClassCardsSeen() {
  const ctx = await getCallerContext();
  if (!ctx) return;
  if (!ctx.roles.includes("TEACHER") || !ctx.teacherId) return;

  const supabase = await createClient();
  await supabase
    .from("classes")
    .update({ teacher_seen_status_at: new Date().toISOString() })
    .eq("created_by_teacher_id", ctx.teacherId);
}

// Kabarin Laoshi lewat WhatsApp tiap kali kartu kelas dia di-approve atau
// di-reject Owner -- pakai nomor HP yang ada di data Laoshi-nya sendiri
// (tabel teachers.phone). Kalau nomornya kosong ATAU gagal kekirim,
// statusnya tetep kesimpen (ga bikin approve/reject gagal) -- tapi
// Owner/Admin dikabarin soal kegagalannya lewat recordNotificationFailure,
// biar ga ada notif yang "ilang diam-diam" tanpa ada yang tau.
async function notifyTeacherClassCardStatus(params: {
  teacherId: string;
  className: string;
  approved: boolean;
  rejectionNote?: string;
}) {
  const supabase = await createClient();
  const { data: teacher } = await supabase
    .from("teachers")
    .select("phone, name")
    .eq("id", params.teacherId)
    .maybeSingle();

  const statusLabel = params.approved ? "APPROVE" : "REJECT";

  if (!teacher?.phone) {
    const msg = `Laoshi ${teacher?.name || "-"} belum punya nomor HP di data Teachers, jadi notif ${statusLabel} Class Card "${params.className}" ga bisa dikirim WA. Tolong kabarin manual & lengkapin nomornya di halaman Teachers.`;
    console.error("[notifyTeacherClassCardStatus]", msg);
    await recordNotificationFailure(msg);
    return;
  }

  const teacherClassCardLink = `${SITE_URL}/class-cards`;
  const message = params.approved
    ? `✅ Kabar baik! Class Card "${params.className}" kamu udah di-APPROVE Owner & sekarang udah tayang buat Murid.\n\nCek: ${teacherClassCardLink}`
    : `❌ Class Card "${params.className}" kamu di-TOLAK Owner.\n\nAlasan: ${
        params.rejectionNote || "-"
      }\n\nCek & edit lagi di sini: ${teacherClassCardLink}`;

  try {
    const result = await sendWhatsApp(normalizePhone(teacher.phone), message);
    console.log(
      "[notifyTeacherClassCardStatus] hasil kirim WA:",
      JSON.stringify(result)
    );
    if (!result.success) {
      await recordNotificationFailure(
        `Gagal kirim notif ${statusLabel} Class Card "${params.className}" ke Laoshi ${
          teacher.name || "-"
        } (${teacher.phone}). Alasan: ${result.reason || "tidak diketahui"}.`
      );
    }
  } catch (err) {
    console.error("[notifyTeacherClassCardStatus] error kirim WA:", err);
    await recordNotificationFailure(
      `Gagal kirim notif ${statusLabel} Class Card "${params.className}" ke Laoshi ${
        teacher.name || "-"
      } (${teacher.phone}). Error: ${
        err instanceof Error ? err.message : String(err)
      }.`
    );
  }
}

// Kabarin Owner lewat WhatsApp tiap kali ada Class Card baru yang perlu
// di-approve -- pakai nomor yang sama kayak reminder konten
// (OWNER_WHATSAPP_NUMBER), lewat helper Fonnte yang udah ada. Kalau
// nomornya belum di-set atau gagal kekirim, ga masalah -- kartu kelasnya
// tetep kesimpen, cuma notifnya yang skip (biar Laoshi tetep bisa
// submit walau WA lagi bermasalah).
async function notifyOwnerNewClassCard(params: {
  teacherName: string | null;
  className: string;
  isPrivate: boolean;
  capacity: number;
}) {
  const ownerPhone = process.env.OWNER_WHATSAPP_NUMBER;
  if (!ownerPhone) {
    const msg = `OWNER_WHATSAPP_NUMBER belum di-set di Vercel, jadi notif Class Card baru ("${params.className}" dari Laoshi ${params.teacherName || "-"}) ga bisa dikirim WA ke Owner. Cek & submit kartu kelas ini manual di halaman Class Card.`;
    console.error("[notifyOwnerNewClassCard]", msg);
    await recordNotificationFailure(msg);
    return;
  }

  const message =
    `📋 Class Card baru menunggu approval!\n\n` +
    `Laoshi: ${params.teacherName || "-"}\n` +
    `Nama Kelas: ${params.className}\n` +
    `Tipe: ${params.isPrivate ? "Private" : "Umum"} (kuota ${params.capacity})\n\n` +
    `Cek & approve di sini: ${SITE_URL}/class-cards`;

  try {
    // Di-log biar kalau WA-nya ga sampe, kita bisa liat di Vercel Runtime
    // Logs apa jawaban dari Fonnte-nya (misal token salah, nomor ga
    // valid, dll) -- bukan cuma "gagal" tanpa alasan.
    const result = await sendWhatsApp(ownerPhone, message);
    console.log("[notifyOwnerNewClassCard] hasil kirim WA:", JSON.stringify(result));
    if (!result.success) {
      await recordNotificationFailure(
        `Gagal kirim notif Class Card baru ("${params.className}" dari Laoshi ${
          params.teacherName || "-"
        }) ke Owner. Alasan: ${result.reason || "tidak diketahui"}.`
      );
    }
  } catch (err) {
    // Notif gagal ga boleh ngegagalin submit kartu kelas -- tapi tetap
    // di-log biar ketauan penyebabnya kalau perlu dicek lagi nanti.
    console.error("[notifyOwnerNewClassCard] error kirim WA:", err);
    await recordNotificationFailure(
      `Gagal kirim notif Class Card baru ("${params.className}" dari Laoshi ${
        params.teacherName || "-"
      }) ke Owner. Error: ${err instanceof Error ? err.message : String(err)}.`
    );
  }
}

// Dulu fungsi ini nembak auth.getUser() + query user_profiles SENDIRI
// (terpisah dari getCurrentProfile() di lib/auth.ts yang udah di-cache
// per request) -- jadi tiap halaman Class Card kebuka, ada 2 kali cek
// login + 2 kali query profil yang sebenernya nanya hal yang SAMA
// PERSIS. Sekarang tinggal "nerjemahin" hasil getCurrentProfile() (yang
// dalam 1 request cuma jalan sekali beneran, sisanya dari cache) ke
// bentuk field yang dipake di file ini -- 13 tempat yang manggil
// getCallerContext() otomatis ikut lebih cepat tanpa perlu diubah
// satu-satu.
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

type ClassCardInput = {
  name: string;
  description: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  startDate: string;
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

// Ambil nomor kode kelas TERBESAR dari SEMUA baris yang ada (bukan cuma
// baris terakhir dibuat) -- kalau cuma ngandelin "baris terakhir + 1",
// nomornya bisa balik ke yang udah kepake kalau urutan created_at-nya ga
// pas, jadi gagal pas insert (unique constraint classes_class_code_key).
// Sama kayak fix yang udah dipakai buat student_code & teacher_code.
async function getMaxClassCodeNumber(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data: allCodes } = await supabase.from("classes").select("class_code");
  let maxNumber = 0;
  (allCodes ?? []).forEach((row) => {
    const match = row.class_code?.match(/\d+/);
    if (match) {
      const n = parseInt(match[0], 10);
      if (n > maxNumber) maxNumber = n;
    }
  });
  return maxNumber;
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

  const maxNumber = await getMaxClassCodeNumber(supabase);

  let inserted = false;
  let lastError: { message: string } | null = null;
  for (let i = 0; i < 5; i++) {
    const classCode = `K${String(maxNumber + 1 + i).padStart(3, "0")}`;
    const nowIso = new Date().toISOString();
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
      start_date: input.startDate || null,
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
      status_updated_at: nowIso,
      // Kartu baru dibuat sama Laoshi sendiri, jadi langsung ditandain
      // "udah dilihat" biar ga ikut kehitung badge notif dia sendiri.
      teacher_seen_status_at: nowIso,
    });

    if (!error) {
      inserted = true;
      lastError = null;
      break;
    }
    lastError = error;
    const isDuplicateCode = error.message.includes("classes_class_code_key");
    if (!isDuplicateCode) break;
  }

  if (!inserted) {
    return { success: false, message: lastError?.message || "Gagal membuat kartu kelas." };
  }

  await notifyOwnerNewClassCard({
    teacherName: ctx.fullName,
    className: input.name.trim(),
    isPrivate: input.isPrivate,
    capacity,
  });

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

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("classes")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      day_of_week: input.dayOfWeek || null,
      start_time: input.startTime || null,
      end_time: input.endTime || null,
      start_date: input.startDate || null,
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
      status_updated_at: nowIso,
      // Laoshi yang lagi ngedit & submit ulang sendiri -- ga usah
      // dianggap "belum dilihat" buat dia sendiri.
      teacher_seen_status_at: nowIso,
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  await notifyOwnerNewClassCard({
    teacherName: ctx.fullName,
    className: input.name.trim(),
    isPrivate: input.isPrivate,
    capacity,
  });

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Kartu kelas dikirim ulang, nunggu di-approve Owner." };
}

// Laoshi hapus kartu kelas dia sendiri -- cuma boleh buat yang masih
// PENDING (belum di-approve) atau REJECTED (ditolak & ga mau diedit
// lagi). Yang udah APPROVED sengaja ga boleh dihapus dari sini karena
// kelasnya udah aktif & mungkin udah ada murid yang join -- itu urusan
// Owner/Admin lewat halaman Classes.
export async function deleteClassCard(id: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("TEACHER") || !ctx.teacherId) {
    return { success: false, message: "Kamu ga punya akses." };
  }

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
      message:
        "Kelas yang udah di-approve ga bisa dihapus dari sini -- hubungi Owner/Admin.",
    };
  }

  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Kartu kelas dihapus." };
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
  const { data: cls } = await supabase
    .from("classes")
    .select("name, created_by_teacher_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("classes")
    .update({
      approval_status: "APPROVED",
      active: true,
      registration_open: true,
      rejection_note: null,
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  if (cls?.created_by_teacher_id) {
    await notifyTeacherClassCardStatus({
      teacherId: cls.created_by_teacher_id,
      className: cls.name,
      approved: true,
    });
  }

  // Begitu di-approve, langsung generate sesi bertanggal buat kelas ini
  // (dari day_of_week + start_date-nya) biar langsung muncul di Weekly
  // Schedule (Laoshi/Owner/Admin) tanpa Owner/Admin harus klik "Generate
  // Sessions" manual lagi. Murid yang nanti join kelas ini otomatis ikut
  // liat sesinya juga karena my-schedule/my-class dia baca dari sesi yang
  // sama (di-filter berdasarkan class_id).
  await generateSessionsForClass(id);

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
  const { data: cls } = await supabase
    .from("classes")
    .select("name, created_by_teacher_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("classes")
    .update({
      approval_status: "REJECTED",
      active: false,
      registration_open: false,
      rejection_note: note.trim(),
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  if (cls?.created_by_teacher_id) {
    await notifyTeacherClassCardStatus({
      teacherId: cls.created_by_teacher_id,
      className: cls.name,
      approved: false,
      rejectionNote: note.trim(),
    });
  }

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
