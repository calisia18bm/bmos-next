"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
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
import { readPaymentProofWithAI } from "@/lib/paymentProof";
import { broadcastToBm } from "@/lib/bmContacts";
import { computeCycleAmount, computeNextDueDate, formatCycleLabel } from "@/lib/monthlyBilling";

// Berapa banyak Class Card yang lagi PENDING (nunggu di-approve Owner) --
// dipakai buat badge notif di sidebar (menu "Approval Kelas") & buat
// widget "Need Attention" di Home. Cuma dihitung buat Owner/Admin (yang
// emang bisa approve) -- role lain selalu dapet 0.
export async function getPendingClassCardCount() {
  const ctx = await getCallerContext();
  if (!ctx) return 0;
  if (!ctx.roles.includes("OWNER") && !ctx.roles.includes("ADMIN")) return 0;

  const supabase = await createClient();
  const [{ count: classCardCount }, { count: joinRequestCount }] = await Promise.all([
    supabase
      .from("classes")
      .select("*", { count: "exact", head: true })
      .eq("approval_status", "PENDING"),
    supabase
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("request_status", "PENDING"),
  ]);

  return (classCardCount ?? 0) + (joinRequestCount ?? 0);
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
    const msg = `Laoshi ${teacher?.name || "-"} belum punya nomor HP di data Teachers, jadi notif ${statusLabel} Class Card "${params.className}" enggak bisa dikirim WA. Tolong kabarin manual & lengkapin nomornya di halaman Teachers.`;
    console.error("[notifyTeacherClassCardStatus]", msg);
    await recordNotificationFailure(msg);
    return;
  }

  const teacherClassCardLink = `${SITE_URL}/class-cards`;
  const message = params.approved
    ? `✅ Kabar baik! Class Card "${params.className}" kamu sudah di-APPROVE BM & sekarang sudah tayang buat Murid.\n\nCek: ${teacherClassCardLink}`
    : `❌ Class Card "${params.className}" kamu di-TOLAK BM.\n\nAlasan: ${
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
    const msg = `OWNER_WHATSAPP_NUMBER belum di-set di Vercel, jadi notif Class Card baru ("${params.className}" dari Laoshi ${params.teacherName || "-"}) enggak bisa dikirim WA ke Owner. Cek & submit kartu kelas ini manual di halaman Class Card.`;
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
  classType: "REGULAR" | "SEMINAR";
  billingType: "SESSION" | "MONTHLY";
  monthlyPrice: string;
  threeMonthDiscountPct: string;
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
    return "Tanggal mulai pendaftaran enggak boleh lebih besar dari tanggal tutup.";
  }
  if (input.billingType === "MONTHLY" && (Number(input.monthlyPrice) || 0) <= 0) {
    return "Harga per bulan wajib diisi buat kelas model bayar bulanan.";
  }
  return null;
}

// Cek syarat minimal Laoshi udah beli sekian bulan bahan ajar (PPT)
// sebelum boleh buka Class Card baru -- angkanya diatur Owner (lihat
// getMinTeacherResourceMonths di bawah). Dihitung dari jumlah request
// beli bahan ajar yang udah di-APPROVE (teacher_resource_purchases),
// 1 bahan ajar dianggap = 1 bulan.
async function checkTeacherResourceGate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teacherId: string
): Promise<string | null> {
  const { data: settings } = await supabase
    .from("app_settings")
    .select("min_teacher_resource_months")
    .eq("id", 1)
    .maybeSingle();
  const minMonths = settings?.min_teacher_resource_months ?? 3;
  if (minMonths <= 0) return null;

  const { count } = await supabase
    .from("teacher_resource_purchases")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId)
    .eq("request_status", "APPROVED");

  if ((count ?? 0) < minMonths) {
    return `Kamu wajib beli minimal ${minMonths} bahan ajar dari BM dulu sebelum bisa buka Class Card (sekarang baru ${
      count ?? 0
    }). Cek halaman Materi buat beli bahan ajarnya.`;
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

  if (notes.length === 0) return "Kartu kelas lengkap, enggak ada catatan khusus.";
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
      message: "Cuma akun Laoshi yang terhubung ke data Laoshi yang bisa buat kelas.",
    };
  }

  const err = validateInput(input);
  if (err) return { success: false, message: err };

  const supabase = await createClient();

  const gateError = await checkTeacherResourceGate(supabase, ctx.teacherId);
  if (gateError) return { success: false, message: gateError };

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
      class_type: input.classType === "SEMINAR" ? "SEMINAR" : "REGULAR",
      billing_type: input.billingType === "MONTHLY" ? "MONTHLY" : "SESSION",
      monthly_price: input.billingType === "MONTHLY" ? Number(input.monthlyPrice) || null : null,
      three_month_discount_pct:
        input.billingType === "MONTHLY" ? Number(input.threeMonthDiscountPct) || 0 : 0,
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

  // Dijadwalin lewat after() biar Laoshi enggak nunggu WA-nya kekirim
  // dulu baru tombol "Submit ke BM" keliatan selesai.
  after(() =>
    notifyOwnerNewClassCard({
      teacherName: ctx.fullName,
      className: input.name.trim(),
      isPrivate: input.isPrivate,
      capacity,
    })
  );

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Kartu kelas dikirim, nunggu di-approve BM." };
}

// Laoshi edit ulang kartu yang di-REJECT (atau masih PENDING) &
// submit ulang -- balik ke status PENDING lagi.
export async function resubmitClassCard(id: string, input: ClassCardInput) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("TEACHER") || !ctx.teacherId) {
    return { success: false, message: "Kamu enggak punya akses." };
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
      message: "Kelas yang sudah di-approve enggak bisa diedit dari sini lagi.",
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
      class_type: input.classType === "SEMINAR" ? "SEMINAR" : "REGULAR",
      billing_type: input.billingType === "MONTHLY" ? "MONTHLY" : "SESSION",
      monthly_price: input.billingType === "MONTHLY" ? Number(input.monthlyPrice) || null : null,
      three_month_discount_pct:
        input.billingType === "MONTHLY" ? Number(input.threeMonthDiscountPct) || 0 : 0,
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

  // Dijadwalin lewat after() biar Laoshi enggak nunggu WA-nya kekirim
  // dulu baru tombol "Submit ke BM" keliatan selesai.
  after(() =>
    notifyOwnerNewClassCard({
      teacherName: ctx.fullName,
      className: input.name.trim(),
      isPrivate: input.isPrivate,
      capacity,
    })
  );

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Kartu kelas dikirim ulang, nunggu di-approve BM." };
}

// Perpanjang (atau majuin) tanggal TUTUP pendaftaran kelas yang udah
// APPROVED -- sengaja dipisah dari resubmitClassCard() di atas, soalnya
// ubah tanggal pendaftaran doang ga perlu di-approve ulang sama BM kayak
// ubah field lain (jadwal/harga/dll), beda kondisi sama kartu yang masih
// PENDING/REJECTED. Boleh dipanggil Laoshi pemilik kartu kelasnya
// SENDIRI, atau Owner/Admin lewat halaman Class Card juga.
export async function extendClassCardRegistration(id: string, registrationEnd: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("classes")
    .select("id, name, created_by_teacher_id, approval_status")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return { success: false, message: "Kartu kelas tidak ditemukan." };

  const isStaff = ctx.roles.includes("OWNER") || ctx.roles.includes("ADMIN");
  const isOwner = ctx.roles.includes("TEACHER") && existing.created_by_teacher_id === ctx.teacherId;
  if (!isStaff && !isOwner) {
    return { success: false, message: "Ini bukan kartu kelas kamu." };
  }
  if (existing.approval_status !== "APPROVED") {
    return {
      success: false,
      message: "Kelas ini belum di-approve, ubah tanggal pendaftarannya lewat Edit & submit ulang aja.",
    };
  }
  if (!registrationEnd) {
    return { success: false, message: "Tanggal tutup pendaftaran wajib diisi." };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (registrationEnd < today) {
    return { success: false, message: "Tanggal tutup pendaftaran enggak boleh di masa lalu." };
  }

  const { error } = await supabase
    .from("classes")
    .update({ registration_end: registrationEnd })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Tanggal tutup pendaftaran berhasil diperpanjang." };
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
    return { success: false, message: "Kamu enggak punya akses." };
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
        "Kelas yang sudah di-approve enggak bisa dihapus dari sini -- hubungi BM.",
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
    // Dijadwalin lewat after() (bukan await langsung) -- kirim WA ke
    // Fonnte itu manggil API luar yang bisa lelet, kalau di-await di
    // sini Owner harus nunggu WA-nya kekirim dulu baru tombol Approve
    // keliatan selesai. Dengan after(), DB update-nya (yang di atas)
    // udah kesimpen & respons "berhasil" balik ke browser DULUAN, WA-nya
    // nyusul kekirim di belakang layar.
    after(() =>
      notifyTeacherClassCardStatus({
        teacherId: cls.created_by_teacher_id!,
        className: cls.name,
        approved: true,
      })
    );
  }

  // Begitu di-approve, langsung generate sesi bertanggal buat kelas ini
  // (dari day_of_week + start_date-nya) biar langsung muncul di Weekly
  // Schedule (Laoshi/Owner/Admin) tanpa Owner/Admin harus klik "Generate
  // Sessions" manual lagi. Murid yang nanti join kelas ini otomatis ikut
  // liat sesinya juga karena my-schedule/my-class dia baca dari sesi yang
  // sama (di-filter berdasarkan class_id). Dijadwalin lewat after() juga
  // -- ini nulis banyak baris ke DB sekaligus, ga perlu bikin Owner
  // nunggu sebelum tombol Approve keliatan selesai.
  after(() => generateSessionsForClass(id));

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
    after(() =>
      notifyTeacherClassCardStatus({
        teacherId: cls.created_by_teacher_id!,
        className: cls.name,
        approved: false,
        rejectionNote: note.trim(),
      })
    );
  }

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Kelas di-reject, Laoshi bakal lihat alasannya." };
}

// Murid join kelas lewat kartu -- first come first served, dibatasin
// kuota & periode pendaftaran. Buat v1: cuma Murid yang BELUM punya
// kelas aktif yang bisa self-join (biar ga kesenggol pindah kelas
// otomatis) -- kalau udah ada kelas, arahin ke Admin buat pindah kelas.
// ============================================================
// Request Join Kelas (payment-gated, dengan bantuan AI baca bukti bayar)
// ============================================================
//
// Alur baru (ganti yang lama, joinClassCard() yang langsung masukin
// Murid ke kelas instant): Murid klik "Join Kelas" -> upload bukti
// transfer -> baris enrollments dibikin dengan request_status=PENDING
// -> AI (Claude) baca gambar buktinya sekadar buat BANTU Admin (nominal/
// tanggal/pengirim kalau keliatan) -- AI TIDAK PERNAH auto-approve/
// reject, itu tetap keputusan Owner/Admin manual lewat
// approveJoinRequest()/rejectJoinRequest() di bawah.
//
// Kelas REGULAR (mingguan) tetap cuma boleh 1 slot aktif/pending per
// Murid (kayak restriksi lama). Kelas SEMINAR (sekali pertemuan) boleh
// dipunya Murid lebih dari 1 sekaligus, SELAMA jadwalnya (hari + jam)
// ga bentrok sama kelas aktif/pending Murid yang lain -- itu yang dicek
// hasScheduleConflict() di bawah.

function timeRangesOverlap(
  aStart?: string | null,
  aEnd?: string | null,
  bStart?: string | null,
  bEnd?: string | null
): boolean {
  if (!aStart || !aEnd || !bStart || !bEnd) return false; // jadwal belum diatur -- ga bisa dicek, anggap ga bentrok
  return aStart < bEnd && bStart < aEnd;
}

async function getNextEnrollmentCode(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
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
  return `ENR${String(nextNumber).padStart(5, "0")}`;
}

export type MyClassEnrollment = {
  enrollmentId: string;
  classId: string;
  className: string;
  classType: "REGULAR" | "SEMINAR";
  dayOfWeek: string | null;
  startTime: string | null;
  endTime: string | null;
  requestStatus: "PENDING" | "APPROVED" | "REJECTED";
  rejectionNote: string | null;
  aiPaymentNote: string | null;
  billingType: "SESSION" | "MONTHLY";
  monthlyPrice: number | null;
  threeMonthDiscountPct: number | null;
  billingCycleMonths: number;
  nextDueDate: string | null;
  lastPaidAt: string | null;
};

// Kelas yang lagi aktif/diproses buat Murid yang login -- dipakai di
// halaman Class Card Murid buat: (1) nampilin status request dia, (2)
// cek slot Reguler & bentrok jadwal sebelum ngirim request baru.
export async function getMyClassEnrollments(): Promise<MyClassEnrollment[]> {
  const ctx = await getCallerContext();
  if (!ctx || !ctx.studentId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select(
      "id, class_id, request_status, rejection_note, ai_payment_note, requested_at, billing_cycle_months, next_due_date, last_paid_at, classes:class_id (name, class_type, day_of_week, start_time, end_time, billing_type, monthly_price, three_month_discount_pct)"
    )
    .eq("student_id", ctx.studentId)
    .in("request_status", ["PENDING", "APPROVED", "REJECTED"])
    .neq("status", "CANCELLED")
    .order("requested_at", { ascending: false });

  return (data ?? [])
    .filter((row: any) => row.classes)
    .map((row: any) => ({
      enrollmentId: row.id,
      classId: row.class_id,
      className: row.classes?.name ?? "-",
      classType: row.classes?.class_type ?? "REGULAR",
      dayOfWeek: row.classes?.day_of_week ?? null,
      startTime: row.classes?.start_time ?? null,
      endTime: row.classes?.end_time ?? null,
      requestStatus: row.request_status,
      rejectionNote: row.rejection_note,
      aiPaymentNote: row.ai_payment_note,
      billingType: row.classes?.billing_type ?? "SESSION",
      monthlyPrice: row.classes?.monthly_price ?? null,
      threeMonthDiscountPct: row.classes?.three_month_discount_pct ?? null,
      billingCycleMonths: row.billing_cycle_months ?? 1,
      nextDueDate: row.next_due_date,
      lastPaidAt: row.last_paid_at,
    }));
}

// Murid submit request join kelas (bukan langsung masuk) -- WAJIB upload
// bukti transfer dulu. Ga langsung aktif, nunggu di-approve Owner/Admin.
export async function requestJoinClassCard(
  classId: string,
  proof: { fileUrl: string; fileName: string; filePath: string },
  cycleMonths: 1 | 3 = 1
) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("STUDENT") || !ctx.studentId) {
    return {
      success: false,
      message: "Cuma akun Murid yang terhubung ke data Murid yang bisa join kelas.",
    };
  }
  if (!proof.fileUrl) {
    return { success: false, message: "Bukti transfer wajib diupload dulu." };
  }

  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select(
      "id, class_code, name, teacher_id, teacher_name, capacity_max, approval_status, active, is_private, registration_start, registration_end, class_type, day_of_week, start_time, end_time, price, billing_type, monthly_price, three_month_discount_pct"
    )
    .eq("id", classId)
    .maybeSingle();

  if (!cls) return { success: false, message: "Kelas tidak ditemukan." };
  if (cls.approval_status !== "APPROVED" || !cls.active) {
    return { success: false, message: "Kelas ini belum/enggak bisa dijoin." };
  }
  if (cls.is_private) {
    return {
      success: false,
      message: "Kelas privat -- daftarnya lewat BM/Laoshi langsung.",
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (cls.registration_start && today < cls.registration_start) {
    return { success: false, message: "Pendaftaran kelas ini belum dibuka." };
  }
  if (cls.registration_end && today > cls.registration_end) {
    return { success: false, message: "Pendaftaran kelas ini sudah ditutup." };
  }

  // Udah ada request PENDING buat kelas yang SAMA -- ga usah dobel.
  const { data: existingPending } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", ctx.studentId)
    .eq("class_id", cls.id)
    .eq("request_status", "PENDING")
    .maybeSingle();
  if (existingPending) {
    return {
      success: false,
      message: "Kamu sudah punya request join buat kelas ini, tunggu di-review BM ya.",
    };
  }

  // Kelas aktif/lagi diproses Murid ini -- buat cek slot Reguler & bentrok jadwal.
  const { data: myEnrollments } = await supabase
    .from("enrollments")
    .select(
      "class_id, request_status, classes:class_id (class_type, day_of_week, start_time, end_time)"
    )
    .eq("student_id", ctx.studentId)
    .in("request_status", ["PENDING", "APPROVED"]);

  const activeOrPending = (myEnrollments ?? []).filter((e: any) => e.classes);

  if (cls.class_type === "REGULAR") {
    const hasRegular = activeOrPending.some(
      (e: any) => e.classes?.class_type === "REGULAR"
    );
    if (hasRegular) {
      return {
        success: false,
        message:
          "Kamu sudah punya kelas Reguler aktif/lagi diproses. Hubungi BM kalau mau pindah kelas.",
      };
    }
  }

  const hasConflict = activeOrPending.some(
    (e: any) =>
      e.classes?.day_of_week &&
      cls.day_of_week &&
      e.classes.day_of_week === cls.day_of_week &&
      timeRangesOverlap(cls.start_time, cls.end_time, e.classes?.start_time, e.classes?.end_time)
  );
  if (hasConflict) {
    return {
      success: false,
      message: "Jadwal kelas ini bentrok sama kelas kamu yang lain.",
    };
  }

  const { count } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("class_id", cls.id)
    .eq("request_status", "APPROVED")
    .eq("status", "ACTIVE");

  if ((count ?? 0) >= cls.capacity_max) {
    return { success: false, message: "Kelas ini sudah penuh." };
  }

  const isMonthly = cls.billing_type === "MONTHLY";
  const chosenCycle: 1 | 3 = isMonthly && cycleMonths === 3 ? 3 : isMonthly ? cycleMonths || 1 : 1;
  const cycleAmount = isMonthly
    ? computeCycleAmount(cls.monthly_price ?? 0, chosenCycle, cls.three_month_discount_pct ?? 0)
    : cls.price ?? null;

  const enrollmentCode = await getNextEnrollmentCode(supabase);

  // Insert-nya LANGSUNG jalan tanpa nunggu AI baca gambar dulu --
  // ai_payment_note diisi null sementara, nanti di-update belakangan.
  // Baca bukti transfer pake Claude vision itu bisa makan waktu
  // beberapa detik (download gambar + panggil API-nya), kalau di-await
  // di sini Murid bakal liat tombol "Kirim Request Join" nge-loading
  // lama padahal request-nya sendiri sebenarnya udah bisa langsung
  // kesimpen. AI note-nya nyusul keisi begitu selesai dibaca di
  // belakang layar (Admin tetap bisa lihat foto buktinya langsung dari
  // awal walau AI note-nya belum muncul).
  const { data: insertedEnrollment, error } = await supabase
    .from("enrollments")
    .insert({
      enrollment_code: enrollmentCode,
      student_id: ctx.studentId,
      class_id: cls.id,
      status: "PENDING",
      request_status: "PENDING",
      payment_proof_url: proof.fileUrl,
      payment_proof_path: proof.filePath,
      ai_payment_note: null,
      requested_at: new Date().toISOString(),
      billing_cycle_months: isMonthly ? chosenCycle : 1,
    })
    .select("id")
    .single();

  if (error) return { success: false, message: error.message };

  // Kabarin Murid & BM lewat WhatsApp begitu bukti transfer kekirim --
  // Murid dikasih tau hasil baca AI-nya (termasuk kalau ada yang
  // JANGGAL, misal nominal ga sesuai), BM (SEMUA akun Owner/Admin yang
  // udah isi nomor HP di Accounts) dikabarin ada request baru + hasil
  // baca AI yang SAMA biar bisa langsung nilai janggal/ga tanpa buka
  // app dulu. Approve/reject tetap manual sama BM -- ini cuma notif.
  //
  // Semua ini (baca AI, WA ke Murid, broadcast ke BM) dijadwalin lewat
  // after() -- baca gambar pake AI + kirim WA (apalagi ke BEBERAPA akun
  // BM sekaligus) itu manggil API luar yang bisa pelan, kalau di-await
  // di sini Murid harus nunggu semuanya kelar dulu baru tombol "Kirim
  // Request Join" keliatan selesai. Dengan after(), request join-nya
  // (yang di atas) udah kesimpen & respons "berhasil" balik ke browser
  // DULUAN, sisanya nyusul di belakang layar.
  after(async () => {
    const aiNote = await readPaymentProofWithAI(proof.fileUrl, {
      name: isMonthly ? `${cls.name} (${formatCycleLabel(chosenCycle)})` : cls.name,
      price: cycleAmount,
    });

    await supabase
      .from("enrollments")
      .update({ ai_payment_note: aiNote })
      .eq("id", insertedEnrollment.id);

    const { data: studentRow } = await supabase
      .from("students")
      .select("name, phone")
      .eq("id", ctx.studentId!)
      .maybeSingle();

    if (studentRow?.phone) {
      const studentMsg = `📝 Request join "${cls.name}" kamu sudah kekirim, lagi ditunggu review BM ya!`;
      try {
        const result = await sendWhatsApp(normalizePhone(studentRow.phone), studentMsg);
        if (!result.success) {
          await recordNotificationFailure(
            `Gagal kirim notif "request join terkirim" ke Murid ${studentRow.name || "-"} (${studentRow.phone}). Alasan: ${result.reason || "tidak diketahui"}.`
          );
        }
      } catch (err) {
        await recordNotificationFailure(
          `Gagal kirim notif "request join terkirim" ke Murid ${studentRow.name || "-"} (${studentRow.phone}). Error: ${err instanceof Error ? err.message : String(err)}.`
        );
      }
    } else {
      await recordNotificationFailure(
        `Murid ${studentRow?.name || "-"} belum punya nomor HP di data Students, jadi notif hasil baca AI request join "${cls.name}" enggak bisa dikirim WA ke dia.`
      );
    }

    await broadcastToBm(
      `📥 Request Join Kelas baru!

` +
        `Murid: ${studentRow?.name || "-"}
` +
        `Kelas: ${cls.name}
` +
        `Biaya: ${cls.price ? `Rp ${cls.price.toLocaleString("id-ID")}` : "Gratis"}

` +
        `${aiNote}

` +
        `Cek & approve/tolak di sini: ${SITE_URL}/class-cards`,
      `Request Join Kelas dari ${studentRow?.name || "-"}`
    );
  });

  revalidatePath("/class-cards", "layout");
  return {
    success: true,
    message: `Request join ${cls.name} terkirim, tunggu di-review BM ya.`,
  };
}

export type PendingJoinRequest = {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  classType: "REGULAR" | "SEMINAR";
  price: number | null;
  paymentProofUrl: string | null;
  aiPaymentNote: string | null;
  requestedAt: string;
};

// Daftar request join yang lagi PENDING -- dipakai Owner/Admin buat
// approve/reject di halaman Class Card.
export async function getPendingJoinRequests(): Promise<PendingJoinRequest[]> {
  const ctx = await getCallerContext();
  if (!ctx) return [];
  if (!ctx.roles.includes("OWNER") && !ctx.roles.includes("ADMIN")) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select(
      "id, student_id, class_id, payment_proof_url, ai_payment_note, requested_at, students:student_id (name), classes:class_id (name, class_type, price)"
    )
    .eq("request_status", "PENDING")
    .order("requested_at", { ascending: true });

  return (data ?? []).map((row: any) => ({
    enrollmentId: row.id,
    studentId: row.student_id,
    studentName: row.students?.name ?? "-",
    classId: row.class_id,
    className: row.classes?.name ?? "-",
    classType: row.classes?.class_type ?? "REGULAR",
    price: row.classes?.price ?? null,
    paymentProofUrl: row.payment_proof_url,
    aiPaymentNote: row.ai_payment_note,
    requestedAt: row.requested_at,
  }));
}

// Owner/Admin approve request join -- SETELAH ini baru murid beneran
// kecatat aktif di kelasnya. Kalau kelasnya REGULAR, students.class_id
// ikut di-update (biar semua fitur lain -- Attendance/PR/Materi/Payroll/
// Weekly Schedule/dll -- yang masih ngandelin students.class_id tetap
// jalan tanpa perlu diubah). Kalau SEMINAR, students.class_id SENGAJA
// ga disentuh -- keanggotaan Seminar cukup lewat tabel enrollments,
// biar Murid tetap bisa punya beberapa Seminar sekaligus.
export async function approveJoinRequest(enrollmentId: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("OWNER") && !ctx.roles.includes("ADMIN")) {
    return { success: false, message: "Cuma Owner/Admin yang bisa approve request join." };
  }

  const supabase = await createClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, student_id, class_id, request_status, billing_cycle_months")
    .eq("id", enrollmentId)
    .maybeSingle();

  if (!enrollment) return { success: false, message: "Request tidak ditemukan." };
  if (enrollment.request_status !== "PENDING") {
    return { success: false, message: "Request ini sudah diproses sebelumnya." };
  }

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, teacher_name, class_type, capacity_max, billing_type")
    .eq("id", enrollment.class_id)
    .maybeSingle();
  if (!cls) return { success: false, message: "Kelas tidak ditemukan." };

  const { count } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("class_id", cls.id)
    .eq("request_status", "APPROVED")
    .eq("status", "ACTIVE");
  if ((count ?? 0) >= cls.capacity_max) {
    return { success: false, message: "Kelas ini sudah penuh, enggak bisa approve lagi." };
  }

  const { error } = await supabase
    .from("enrollments")
    .update({
      request_status: "APPROVED",
      status: "ACTIVE",
      reviewed_by_name: ctx.fullName,
      rejection_note: null,
    })
    .eq("id", enrollmentId);
  if (error) return { success: false, message: error.message };

  if (cls.class_type === "REGULAR") {
    await supabase
      .from("students")
      .update({
        class_id: cls.id,
        class_name: cls.name,
        teacher_name: cls.teacher_name,
      })
      .eq("id", enrollment.student_id);
  }

  // Kelas billing bulanan: begitu di-approve, anggap pembayaran pertama
  // udah beres -- set Status Murid ke "Sudah Bayar" (AKTIF) & hitung
  // tanggal jatuh tempo berikutnya dari hari ini + siklus yang dipilih
  // Murid pas join (1 atau 3 bulan).
  if (cls.billing_type === "MONTHLY") {
    const todayIso = new Date().toISOString().slice(0, 10);
    const cycleMonths = enrollment.billing_cycle_months || 1;
    await supabase
      .from("students")
      .update({ payment_status: "AKTIF" })
      .eq("id", enrollment.student_id);
    await supabase
      .from("enrollments")
      .update({
        last_paid_at: todayIso,
        next_due_date: computeNextDueDate(todayIso, cycleMonths),
      })
      .eq("id", enrollmentId);
  }

  // Kabarin Murid lewat WhatsApp begitu request join-nya di-approve BM.
  // Dijadwalin lewat after() -- lihat komentar panjang di
  // requestJoinClassCard soal kenapa ga di-await langsung.
  after(async () => {
    const { data: approvedStudent } = await supabase
      .from("students")
      .select("name, phone")
      .eq("id", enrollment.student_id)
      .maybeSingle();

    if (approvedStudent?.phone) {
      const studentMsg = `✅ Request join "${cls.name}" kamu sudah disetujui BM! Sampai ketemu di kelasnya ya.`;
      try {
        const result = await sendWhatsApp(normalizePhone(approvedStudent.phone), studentMsg);
        if (!result.success) {
          await recordNotificationFailure(
            `Gagal kirim notif "request join disetujui" ke Murid ${approvedStudent.name || "-"} (${approvedStudent.phone}). Alasan: ${result.reason || "tidak diketahui"}.`
          );
        }
      } catch (err) {
        await recordNotificationFailure(
          `Gagal kirim notif "request join disetujui" ke Murid ${approvedStudent.name || "-"} (${approvedStudent.phone}). Error: ${err instanceof Error ? err.message : String(err)}.`
        );
      }
    } else {
      await recordNotificationFailure(
        `Murid ${approvedStudent?.name || "-"} belum punya nomor HP di data Students, jadi notif "request join disetujui" buat kelas "${cls.name}" enggak bisa dikirim WA ke dia.`
      );
    }
  });

  revalidatePath("/class-cards", "layout");
  revalidatePath("/", "layout");
  return { success: true, message: `Request join ${cls.name} disetujui.` };
}

export async function rejectJoinRequest(enrollmentId: string, note: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("OWNER") && !ctx.roles.includes("ADMIN")) {
    return { success: false, message: "Cuma Owner/Admin yang bisa tolak request join." };
  }

  const cleanedNote = note.trim();
  if (!cleanedNote) {
    return { success: false, message: "Kasih catatan alasan penolakan dulu buat Murid." };
  }

  const supabase = await createClient();
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, request_status, class_id, student_id")
    .eq("id", enrollmentId)
    .maybeSingle();
  if (!enrollment) return { success: false, message: "Request tidak ditemukan." };
  if (enrollment.request_status !== "PENDING") {
    return { success: false, message: "Request ini sudah diproses sebelumnya." };
  }

  const { error } = await supabase
    .from("enrollments")
    .update({
      request_status: "REJECTED",
      status: "CANCELLED",
      rejection_note: cleanedNote,
      reviewed_by_name: ctx.fullName,
    })
    .eq("id", enrollmentId);
  if (error) return { success: false, message: error.message };

  // Kabarin Murid lewat WhatsApp begitu request join-nya ditolak BM,
  // sekalian alasannya biar Murid tau harus benerin apa. Dijadwalin
  // lewat after() -- sama alasannya kayak di approveJoinRequest.
  after(async () => {
    const [{ data: rejectedClass }, { data: rejectedStudent }] = await Promise.all([
      supabase.from("classes").select("name").eq("id", enrollment.class_id).maybeSingle(),
      supabase.from("students").select("name, phone").eq("id", enrollment.student_id).maybeSingle(),
    ]);

    if (rejectedStudent?.phone) {
      const studentMsg = `❌ Request join "${rejectedClass?.name || "-"}" kamu ditolak BM. Alasan: ${cleanedNote}`;
      try {
        const result = await sendWhatsApp(normalizePhone(rejectedStudent.phone), studentMsg);
        if (!result.success) {
          await recordNotificationFailure(
            `Gagal kirim notif "request join ditolak" ke Murid ${rejectedStudent.name || "-"} (${rejectedStudent.phone}). Alasan: ${result.reason || "tidak diketahui"}.`
          );
        }
      } catch (err) {
        await recordNotificationFailure(
          `Gagal kirim notif "request join ditolak" ke Murid ${rejectedStudent.name || "-"} (${rejectedStudent.phone}). Error: ${err instanceof Error ? err.message : String(err)}.`
        );
      }
    } else {
      await recordNotificationFailure(
        `Murid ${rejectedStudent?.name || "-"} belum punya nomor HP di data Students, jadi notif "request join ditolak" buat kelas "${rejectedClass?.name || "-"}" enggak bisa dikirim WA ke dia.`
      );
    }
  });

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Request join ditolak." };
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

// Minimal berapa bulan bahan ajar (PPT) yang wajib dibeli & disetujui
// BM dulu sebelum Laoshi bisa buka Class Card baru -- diatur Owner,
// dicek di checkTeacherResourceGate() pas submitClassCard.
export async function getMinTeacherResourceMonths(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("min_teacher_resource_months")
    .eq("id", 1)
    .maybeSingle();
  return data?.min_teacher_resource_months ?? 3;
}

export async function saveMinTeacherResourceMonths(months: number) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("OWNER")) {
    return { success: false, message: "Cuma Owner yang bisa atur syarat minimal bahan ajar." };
  }
  if (!Number.isFinite(months) || months < 0) {
    return { success: false, message: "Jumlah bulan enggak valid." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, min_teacher_resource_months: Math.floor(months) });

  if (error) return { success: false, message: error.message };

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Syarat minimal bahan ajar disimpan." };
}

// ============================================================
// Pembayaran BULANAN lanjutan (buat Class Card billing_type='MONTHLY')
// -- setelah join pertama disetujui, tiap kali mau lanjut bulan
// berikutnya (atau bayar 3 bulan sekaligus), Murid upload bukti
// transfer baru lewat submitMonthlyPayment(), direview manual sama BM
// kayak request join, pakai AI bantu baca nominal juga.
// ============================================================

export async function submitMonthlyPayment(
  enrollmentId: string,
  cycleMonths: 1 | 3,
  proof: { fileUrl: string; fileName: string; filePath: string }
) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("STUDENT") || !ctx.studentId) {
    return {
      success: false,
      message: "Cuma akun Murid yang terhubung ke data Murid yang bisa bayar kelas.",
    };
  }
  if (!proof.fileUrl) {
    return { success: false, message: "Bukti transfer wajib diupload dulu." };
  }

  const supabase = await createClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id, student_id, class_id, request_status, status")
    .eq("id", enrollmentId)
    .eq("student_id", ctx.studentId)
    .maybeSingle();

  if (!enrollment) return { success: false, message: "Kelas ini enggak ditemukan di data kamu." };
  if (enrollment.request_status !== "APPROVED" || enrollment.status !== "ACTIVE") {
    return { success: false, message: "Kelas ini belum aktif, enggak bisa bayar lanjutan." };
  }

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, billing_type, monthly_price, three_month_discount_pct")
    .eq("id", enrollment.class_id)
    .maybeSingle();
  if (!cls) return { success: false, message: "Kelas tidak ditemukan." };
  if (cls.billing_type !== "MONTHLY") {
    return { success: false, message: "Kelas ini bukan model bayar bulanan." };
  }

  const { data: existingPending } = await supabase
    .from("monthly_payments")
    .select("id")
    .eq("enrollment_id", enrollmentId)
    .eq("request_status", "PENDING")
    .maybeSingle();
  if (existingPending) {
    return {
      success: false,
      message: "Kamu sudah punya bukti bayar yang lagi ditunggu review BM buat kelas ini.",
    };
  }

  const chosenCycle: 1 | 3 = cycleMonths === 3 ? 3 : 1;
  const cycleAmount = computeCycleAmount(
    cls.monthly_price ?? 0,
    chosenCycle,
    cls.three_month_discount_pct ?? 0
  );

  // Sama kayak requestJoinClassCard -- insert LANGSUNG tanpa nunggu AI
  // baca gambar dulu, biar Murid enggak nunggu lama pas klik "Kirim
  // Bukti Bayar". AI note + notif WA nyusul di after() di bawah.
  const { data: insertedPayment, error } = await supabase
    .from("monthly_payments")
    .insert({
      enrollment_id: enrollmentId,
      student_id: ctx.studentId,
      class_id: cls.id,
      cycle_months: chosenCycle,
      amount: cycleAmount,
      payment_proof_url: proof.fileUrl,
      payment_proof_path: proof.filePath,
      ai_payment_note: null,
      requested_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { success: false, message: error.message };

  after(async () => {
    const aiNote = await readPaymentProofWithAI(proof.fileUrl, {
      name: `${cls.name} (${formatCycleLabel(chosenCycle)})`,
      price: cycleAmount,
    });

    await supabase
      .from("monthly_payments")
      .update({ ai_payment_note: aiNote })
      .eq("id", insertedPayment.id);

    const { data: studentRow } = await supabase
      .from("students")
      .select("name, phone")
      .eq("id", ctx.studentId!)
      .maybeSingle();

    if (studentRow?.phone) {
      const studentMsg = `📝 Bukti bayar bulanan kamu buat kelas "${cls.name}" sudah kekirim, lagi ditunggu review BM ya!`;
      try {
        const result = await sendWhatsApp(normalizePhone(studentRow.phone), studentMsg);
        if (!result.success) {
          await recordNotificationFailure(
            `Gagal kirim notif "bukti bayar bulanan terkirim" ke Murid ${studentRow.name || "-"} (${studentRow.phone}). Alasan: ${result.reason || "tidak diketahui"}.`
          );
        }
      } catch (err) {
        await recordNotificationFailure(
          `Gagal kirim notif "bukti bayar bulanan terkirim" ke Murid ${studentRow.name || "-"} (${studentRow.phone}). Error: ${err instanceof Error ? err.message : String(err)}.`
        );
      }
    } else {
      await recordNotificationFailure(
        `Murid ${studentRow?.name || "-"} belum punya nomor HP di data Students, jadi notif bukti bayar bulanan kelas "${cls.name}" enggak bisa dikirim WA ke dia.`
      );
    }

    await broadcastToBm(
      `💰 Bukti bayar bulanan baru!\n\n` +
        `Murid: ${studentRow?.name || "-"}\n` +
        `Kelas: ${cls.name}\n` +
        `Siklus: ${formatCycleLabel(chosenCycle)}\n` +
        `Nominal: Rp ${cycleAmount.toLocaleString("id-ID")}\n\n` +
        `${aiNote}\n\n` +
        `Cek & approve/tolak di sini: ${SITE_URL}/class-cards`,
      `Bukti Bayar Bulanan dari ${studentRow?.name || "-"}`
    );
  });

  revalidatePath("/class-cards", "layout");
  return {
    success: true,
    message: "Bukti bayar terkirim, tunggu di-review BM ya.",
  };
}

export type PendingMonthlyPayment = {
  paymentId: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  cycleMonths: number;
  amount: number | null;
  paymentProofUrl: string | null;
  aiPaymentNote: string | null;
  requestedAt: string;
};

// Daftar bukti bayar bulanan yang lagi PENDING -- dipakai Owner/Admin
// buat approve/reject, sama kayak getPendingJoinRequests().
export async function getPendingMonthlyPayments(): Promise<PendingMonthlyPayment[]> {
  const ctx = await getCallerContext();
  if (!ctx) return [];
  if (!ctx.roles.includes("OWNER") && !ctx.roles.includes("ADMIN")) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_payments")
    .select(
      "id, student_id, class_id, cycle_months, amount, payment_proof_url, ai_payment_note, requested_at, students:student_id (name), classes:class_id (name)"
    )
    .eq("request_status", "PENDING")
    .order("requested_at", { ascending: true });

  return (data ?? []).map((row: any) => ({
    paymentId: row.id,
    studentId: row.student_id,
    studentName: row.students?.name ?? "-",
    classId: row.class_id,
    className: row.classes?.name ?? "-",
    cycleMonths: row.cycle_months ?? 1,
    amount: row.amount ?? null,
    paymentProofUrl: row.payment_proof_url,
    aiPaymentNote: row.ai_payment_note,
    requestedAt: row.requested_at,
  }));
}

export async function approveMonthlyPayment(paymentId: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("OWNER") && !ctx.roles.includes("ADMIN")) {
    return { success: false, message: "Cuma Owner/Admin yang bisa approve pembayaran." };
  }

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("monthly_payments")
    .select("id, enrollment_id, student_id, class_id, cycle_months, request_status")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment) return { success: false, message: "Pembayaran tidak ditemukan." };
  if (payment.request_status !== "PENDING") {
    return { success: false, message: "Pembayaran ini sudah diproses sebelumnya." };
  }

  const { data: cls } = await supabase
    .from("classes")
    .select("name")
    .eq("id", payment.class_id)
    .maybeSingle();

  const todayIso = new Date().toISOString().slice(0, 10);
  const cycleMonths = payment.cycle_months || 1;

  const { error } = await supabase
    .from("monthly_payments")
    .update({
      request_status: "APPROVED",
      reviewed_by_name: ctx.fullName,
      reviewed_at: new Date().toISOString(),
      rejection_note: null,
    })
    .eq("id", paymentId);
  if (error) return { success: false, message: error.message };

  await supabase
    .from("students")
    .update({ payment_status: "AKTIF" })
    .eq("id", payment.student_id);

  await supabase
    .from("enrollments")
    .update({
      last_paid_at: todayIso,
      next_due_date: computeNextDueDate(todayIso, cycleMonths),
    })
    .eq("id", payment.enrollment_id);

  after(async () => {
    const { data: student } = await supabase
      .from("students")
      .select("name, phone")
      .eq("id", payment.student_id)
      .maybeSingle();

    if (student?.phone) {
      const msg = `✅ Bukti bayar bulanan kamu buat kelas "${cls?.name || "-"}" sudah disetujui BM! Makasih ya.`;
      try {
        const result = await sendWhatsApp(normalizePhone(student.phone), msg);
        if (!result.success) {
          await recordNotificationFailure(
            `Gagal kirim notif "pembayaran bulanan disetujui" ke Murid ${student.name || "-"} (${student.phone}). Alasan: ${result.reason || "tidak diketahui"}.`
          );
        }
      } catch (err) {
        await recordNotificationFailure(
          `Gagal kirim notif "pembayaran bulanan disetujui" ke Murid ${student.name || "-"} (${student.phone}). Error: ${err instanceof Error ? err.message : String(err)}.`
        );
      }
    } else {
      await recordNotificationFailure(
        `Murid ${student?.name || "-"} belum punya nomor HP di data Students, jadi notif "pembayaran bulanan disetujui" enggak bisa dikirim WA ke dia.`
      );
    }
  });

  revalidatePath("/class-cards", "layout");
  revalidatePath("/", "layout");
  return { success: true, message: "Pembayaran bulanan disetujui." };
}

export async function rejectMonthlyPayment(paymentId: string, note: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("OWNER") && !ctx.roles.includes("ADMIN")) {
    return { success: false, message: "Cuma Owner/Admin yang bisa tolak pembayaran." };
  }

  const cleanedNote = note.trim();
  if (!cleanedNote) {
    return { success: false, message: "Kasih catatan alasan penolakan dulu buat Murid." };
  }

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("monthly_payments")
    .select("id, student_id, class_id, request_status")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment) return { success: false, message: "Pembayaran tidak ditemukan." };
  if (payment.request_status !== "PENDING") {
    return { success: false, message: "Pembayaran ini sudah diproses sebelumnya." };
  }

  const { error } = await supabase
    .from("monthly_payments")
    .update({
      request_status: "REJECTED",
      reviewed_by_name: ctx.fullName,
      reviewed_at: new Date().toISOString(),
      rejection_note: cleanedNote,
    })
    .eq("id", paymentId);
  if (error) return { success: false, message: error.message };

  after(async () => {
    const [{ data: cls }, { data: student }] = await Promise.all([
      supabase.from("classes").select("name").eq("id", payment.class_id).maybeSingle(),
      supabase.from("students").select("name, phone").eq("id", payment.student_id).maybeSingle(),
    ]);

    if (student?.phone) {
      const msg = `❌ Bukti bayar bulanan kamu buat kelas "${cls?.name || "-"}" ditolak BM. Alasan: ${cleanedNote}\n\nSilakan upload ulang bukti transfer yang bener ya.`;
      try {
        const result = await sendWhatsApp(normalizePhone(student.phone), msg);
        if (!result.success) {
          await recordNotificationFailure(
            `Gagal kirim notif "pembayaran bulanan ditolak" ke Murid ${student.name || "-"} (${student.phone}). Alasan: ${result.reason || "tidak diketahui"}.`
          );
        }
      } catch (err) {
        await recordNotificationFailure(
          `Gagal kirim notif "pembayaran bulanan ditolak" ke Murid ${student.name || "-"} (${student.phone}). Error: ${err instanceof Error ? err.message : String(err)}.`
        );
      }
    } else {
      await recordNotificationFailure(
        `Murid ${student?.name || "-"} belum punya nomor HP di data Students, jadi notif "pembayaran bulanan ditolak" enggak bisa dikirim WA ke dia.`
      );
    }
  });

  revalidatePath("/class-cards", "layout");
  return { success: true, message: "Pembayaran bulanan ditolak." };
}

export { computeCommission };
