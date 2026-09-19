"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { readPaymentProofWithAI } from "@/lib/paymentProof";
import { sendWhatsApp, normalizePhone } from "@/lib/fonnte";
import { recordNotificationFailure } from "@/lib/notifyFailure";
import { broadcastToBm } from "@/lib/bmContacts";
import { SITE_URL } from "@/lib/site";

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
    fullName: profile.full_name,
  };
}

// Cuma Owner/Admin yang boleh upload materi langsung ke kelas -- Laoshi
// SUDAH GA BISA upload materi sendiri lagi (baik langsung ke kelas,
// maupun submit draft ke Admin, lihat submitTeacherResourceDraft di
// bawah). Alur baru: Admin/Owner upload bahan ajar berbayar/gratis ke
// teacher_resources, Laoshi beli (kalau berbayar), abis itu Admin/Owner
// yang "Kirim ke Murid" -- itu yang bikin baris baru di tabel materials
// ini (lihat sendResourceToClasses di bawah).
export async function createMaterial(input: {
  classId: string;
  title: string;
  description: string;
  fileUrl: string;
  fileName: string;
  filePath: string;
}) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };

  const isStaff = ctx.roles.includes("OWNER") || ctx.roles.includes("ADMIN");

  if (!isStaff) {
    return {
      success: false,
      message:
        "Laoshi sudah ga bisa upload materi sendiri lagi -- materi sekarang dikirim otomatis sama BM setelah beli bahan ajar.",
    };
  }

  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, teacher_id, teacher_name")
    .eq("id", input.classId)
    .maybeSingle();

  if (!cls) return { success: false, message: "Kelas tidak ditemukan." };

  const title = input.title.trim();
  if (!title) return { success: false, message: "Judul materi wajib diisi." };

  const { error } = await supabase.from("materials").insert({
    class_id: cls.id,
    class_name: cls.name,
    teacher_id: cls.teacher_id,
    teacher_name: cls.teacher_name,
    title,
    description: input.description.trim() || null,
    file_url: input.fileUrl,
    file_name: input.fileName,
    file_path: input.filePath,
  });

  if (error) return { success: false, message: error.message };

  revalidatePath("/materials", "layout");
  return { success: true, message: "Materi berhasil diupload." };
}

export async function deleteMaterial(id: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };

  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materials")
    .select("id, teacher_id, file_path")
    .eq("id", id)
    .maybeSingle();

  if (!material) return { success: false, message: "Materi tidak ditemukan." };

  const isStaff = ctx.roles.includes("OWNER") || ctx.roles.includes("ADMIN");

  if (!isStaff) {
    return { success: false, message: "Kamu ga punya akses hapus materi ini." };
  }

  if (material.file_path) {
    await supabase.storage.from("materials").remove([material.file_path]);
  }

  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/materials", "layout");
  return { success: true, message: "Materi dihapus." };
}

// ============================================================
// Bahan Ajar dari Admin/Owner ke Laoshi -- cuma Owner/Admin yang boleh
// upload/hapus. Laoshi CUMA dikasih pdf_file_url lewat query di halaman
// (bukan dibatesin di sini), lihat app/(app)/materials/page.tsx.
// ============================================================
export async function createTeacherResource(input: {
  title: string;
  description: string;
  pdfFileUrl: string;
  pdfFileName: string;
  pdfFilePath: string;
  originalFileUrl: string;
  originalFileName: string;
  originalFilePath: string;
  price?: string;
}) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };

  const isStaff = ctx.roles.includes("OWNER") || ctx.roles.includes("ADMIN");
  if (!isStaff) {
    return { success: false, message: "Cuma Owner/Admin yang bisa upload bahan ajar." };
  }

  const title = input.title.trim();
  if (!title) return { success: false, message: "Judul wajib diisi." };
  if (!input.pdfFileUrl) return { success: false, message: "File PDF wajib diupload." };

  const supabase = await createClient();
  const { error } = await supabase.from("teacher_resources").insert({
    title,
    description: input.description.trim() || null,
    pdf_file_url: input.pdfFileUrl,
    pdf_file_name: input.pdfFileName,
    pdf_file_path: input.pdfFilePath,
    original_file_url: input.originalFileUrl || null,
    original_file_name: input.originalFileName || null,
    original_file_path: input.originalFilePath || null,
    uploaded_by_name: ctx.fullName,
    price: Number(input.price) || 0,
  });

  if (error) return { success: false, message: error.message };

  revalidatePath("/materials", "layout");
  return { success: true, message: "Bahan ajar berhasil diupload." };
}

// ============================================================
// [DIHENTIKAN] Dulu Laoshi bisa submit draft materi buat direview Admin.
// Sekarang semua bahan ajar HARUS diupload langsung sama Admin/Owner
// (createTeacherResource di atas) -- Laoshi cuma bisa beli & pake, ga
// bisa upload/submit apa-apa lagi. Fungsi ini sengaja dibiarin ada
// (bukan dihapus) supaya kalau ada kode lama yang masih manggil ini
// (cache client lama dll) dapet pesan yang jelas, bukan error nyasar.
// Submission LAMA yang statusnya masih PENDING tetap bisa direview
// Admin/Owner seperti biasa lewat approveTeacherResourceSubmission /
// rejectTeacherResourceSubmission di bawah.
// ============================================================
export async function submitTeacherResourceDraft(_input: {
  title: string;
  description: string;
  fileUrl: string;
  fileName: string;
  filePath: string;
}) {
  return {
    success: false,
    message:
      "Fitur submit materi oleh Laoshi sudah ga ada lagi -- bahan ajar sekarang diupload langsung sama BM.",
  };
}

// Owner/Admin approve submission LAMA (peninggalan sebelum fitur submit
// Laoshi dihentikan) -- WAJIB upload versi PDF final, yang otomatis
// dipublish ke teacher_resources (jadi bisa dipakai semua Laoshi).
export async function approveTeacherResourceSubmission(
  submissionId: string,
  input: {
    pdfFileUrl: string;
    pdfFileName: string;
    pdfFilePath: string;
    originalFileUrl: string;
    originalFileName: string;
    originalFilePath: string;
    price?: string;
  }
) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };

  const isStaff = ctx.roles.includes("OWNER") || ctx.roles.includes("ADMIN");
  if (!isStaff) {
    return { success: false, message: "Cuma Owner/Admin yang bisa approve materi." };
  }
  if (!input.pdfFileUrl) {
    return { success: false, message: "File PDF final wajib diupload dulu buat approve." };
  }

  const supabase = await createClient();
  const { data: submission } = await supabase
    .from("teacher_resource_submissions")
    .select("id, title, description, status")
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) return { success: false, message: "Submission tidak ditemukan." };
  if (submission.status === "APPROVED") {
    return { success: false, message: "Submission ini udah di-approve sebelumnya." };
  }

  const { data: published, error: insertError } = await supabase
    .from("teacher_resources")
    .insert({
      title: submission.title,
      description: submission.description,
      pdf_file_url: input.pdfFileUrl,
      pdf_file_name: input.pdfFileName,
      pdf_file_path: input.pdfFilePath,
      original_file_url: input.originalFileUrl || null,
      original_file_name: input.originalFileName || null,
      original_file_path: input.originalFilePath || null,
      uploaded_by_name: ctx.fullName,
      price: Number(input.price) || 0,
    })
    .select("id")
    .single();

  if (insertError) return { success: false, message: insertError.message };

  const { error } = await supabase
    .from("teacher_resource_submissions")
    .update({
      status: "APPROVED",
      published_resource_id: published.id,
      reviewed_by_name: ctx.fullName,
      rejection_note: null,
    })
    .eq("id", submissionId);

  if (error) return { success: false, message: error.message };

  revalidatePath("/materials", "layout");
  return {
    success: true,
    message: "Materi disetujui & dipublish jadi PDF -- sekarang bisa dipakai semua Laoshi.",
  };
}

export async function rejectTeacherResourceSubmission(submissionId: string, note: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };

  const isStaff = ctx.roles.includes("OWNER") || ctx.roles.includes("ADMIN");
  if (!isStaff) {
    return { success: false, message: "Cuma Owner/Admin yang bisa tolak submission." };
  }

  const cleanedNote = note.trim();
  if (!cleanedNote) {
    return { success: false, message: "Kasih catatan alasan penolakan dulu buat Laoshi." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("teacher_resource_submissions")
    .update({
      status: "REJECTED",
      rejection_note: cleanedNote,
      reviewed_by_name: ctx.fullName,
    })
    .eq("id", submissionId);

  if (error) return { success: false, message: error.message };

  revalidatePath("/materials", "layout");
  return { success: true, message: "Submission ditolak." };
}

export async function deleteTeacherResource(id: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };

  const isStaff = ctx.roles.includes("OWNER") || ctx.roles.includes("ADMIN");
  if (!isStaff) {
    return { success: false, message: "Cuma Owner/Admin yang bisa hapus bahan ajar." };
  }

  const supabase = await createClient();
  const { data: resource } = await supabase
    .from("teacher_resources")
    .select("id, pdf_file_path, original_file_path")
    .eq("id", id)
    .maybeSingle();

  if (!resource) return { success: false, message: "Bahan ajar tidak ditemukan." };

  const pathsToRemove = [resource.pdf_file_path, resource.original_file_path].filter(
    (p): p is string => !!p
  );
  if (pathsToRemove.length > 0) {
    await supabase.storage.from("teacher-resources").remove(pathsToRemove);
  }

  const { error } = await supabase.from("teacher_resources").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/materials", "layout");
  return { success: true, message: "Bahan ajar dihapus." };
}

// ============================================================
// Beli Bahan Ajar Berbayar -- Owner/Admin bisa kasih harga (atau Rp 0 /
// Gratis) pas upload bahan ajar. Kalau harganya > 0, Laoshi WAJIB upload
// bukti transfer dulu (mirip alur Join Kelas Murid), request-nya
// di-review manual Owner/Admin (AI cuma bantu baca bukti, BUKAN yang
// mutusin approve/reject).
// ============================================================

export type MyResourcePurchase = {
  purchaseId: string;
  resourceId: string;
  requestStatus: "PENDING" | "APPROVED" | "REJECTED";
  rejectionNote: string | null;
  aiPaymentNote: string | null;
};

// Status pembelian bahan ajar berbayar buat Laoshi yang login -- dipakai
// TeacherResourceList buat mutusin resource mana yang udah bisa didownload
// (Gratis, atau harga > 0 tapi requestnya APPROVED) vs yang masih perlu
// "Beli PPT" dulu.
export async function getMyResourcePurchases(): Promise<MyResourcePurchase[]> {
  const ctx = await getCallerContext();
  if (!ctx || !ctx.teacherId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("teacher_resource_purchases")
    .select("id, resource_id, request_status, rejection_note, ai_payment_note")
    .eq("teacher_id", ctx.teacherId)
    .neq("status", "CANCELLED")
    .order("requested_at", { ascending: false });

  return (data ?? []).map((row) => ({
    purchaseId: row.id,
    resourceId: row.resource_id,
    requestStatus: row.request_status,
    rejectionNote: row.rejection_note,
    aiPaymentNote: row.ai_payment_note,
  }));
}

// Laoshi submit request beli bahan ajar berbayar -- WAJIB upload bukti
// transfer. Ga langsung bisa download, nunggu di-approve Owner/Admin.
export async function requestPurchaseResource(
  resourceId: string,
  proof: { fileUrl: string; fileName: string; filePath: string }
) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("TEACHER") || !ctx.teacherId) {
    return {
      success: false,
      message: "Cuma akun Laoshi yang terhubung ke data Laoshi yang bisa beli bahan ajar.",
    };
  }
  if (!proof.fileUrl) {
    return { success: false, message: "Bukti transfer wajib diupload dulu." };
  }

  const supabase = await createClient();

  const { data: resource } = await supabase
    .from("teacher_resources")
    .select("id, title, price")
    .eq("id", resourceId)
    .maybeSingle();
  if (!resource) return { success: false, message: "Bahan ajar tidak ditemukan." };
  if (!resource.price || resource.price <= 0) {
    return { success: false, message: "Bahan ajar ini gratis, ga perlu beli." };
  }

  const { data: existingPending } = await supabase
    .from("teacher_resource_purchases")
    .select("id")
    .eq("teacher_id", ctx.teacherId)
    .eq("resource_id", resourceId)
    .eq("request_status", "PENDING")
    .maybeSingle();
  if (existingPending) {
    return {
      success: false,
      message: "Kamu udah punya request beli buat bahan ajar ini, tunggu di-review BM ya.",
    };
  }

  const aiNote = await readPaymentProofWithAI(proof.fileUrl, {
    name: resource.title,
    price: resource.price,
  });

  const { error } = await supabase.from("teacher_resource_purchases").insert({
    teacher_id: ctx.teacherId,
    resource_id: resourceId,
    status: "PENDING",
    request_status: "PENDING",
    payment_proof_url: proof.fileUrl,
    payment_proof_path: proof.filePath,
    ai_payment_note: aiNote,
    requested_at: new Date().toISOString(),
  });

  if (error) return { success: false, message: error.message };

  // Kabarin Laoshi & BM lewat WhatsApp begitu bukti transfer kekirim --
  // sama persis polanya kayak notif request join kelas Murid (lihat
  // app/(app)/class-cards/actions.ts) -- Laoshi dikasih tau hasil baca
  // AI-nya (termasuk kalau ada yang JANGGAL), BM (SEMUA akun Owner/
  // Admin yang udah isi nomor HP di Accounts) dikabarin ada request
  // beli baru + hasil baca AI yang SAMA. Approve/reject tetap manual.
  const { data: teacherRow } = await supabase
    .from("teachers")
    .select("name, phone")
    .eq("id", ctx.teacherId)
    .maybeSingle();

  if (teacherRow?.phone) {
    const teacherMsg =
      `📝 Request beli "${resource.title}" kamu udah kekirim, lagi ditunggu review BM.

` +
      `🤖 Hasil baca AI dari bukti transfer kamu:
${aiNote}

` +
      `Kalau ada yang janggal (misal nominal beda), BM bakal tanya/koreksi manual sebelum approve. Ditunggu ya!`;
    try {
      const result = await sendWhatsApp(normalizePhone(teacherRow.phone), teacherMsg);
      if (!result.success) {
        await recordNotificationFailure(
          `Gagal kirim notif "request beli bahan ajar terkirim" ke Laoshi ${teacherRow.name || "-"} (${teacherRow.phone}). Alasan: ${result.reason || "tidak diketahui"}.`
        );
      }
    } catch (err) {
      await recordNotificationFailure(
        `Gagal kirim notif "request beli bahan ajar terkirim" ke Laoshi ${teacherRow.name || "-"} (${teacherRow.phone}). Error: ${err instanceof Error ? err.message : String(err)}.`
      );
    }
  } else {
    await recordNotificationFailure(
      `Laoshi ${teacherRow?.name || "-"} belum punya nomor HP di data Teachers, jadi notif hasil baca AI request beli "${resource.title}" ga bisa dikirim WA ke dia.`
    );
  }

  await broadcastToBm(
    `📥 Request Beli Bahan Ajar baru!

` +
      `Laoshi: ${teacherRow?.name || "-"}
` +
      `Bahan Ajar: ${resource.title}
` +
      `Harga: Rp ${resource.price.toLocaleString("id-ID")}

` +
      `🤖 Hasil baca AI bukti transfer:
${aiNote}

` +
      `Cek & approve/tolak di sini: ${SITE_URL}/materials`,
    `Request Beli Bahan Ajar dari ${teacherRow?.name || "-"}`
  );

  revalidatePath("/materials", "layout");
  return {
    success: true,
    message: `Request beli "${resource.title}" terkirim, tunggu di-review BM ya.`,
  };
}

export type PendingResourcePurchase = {
  purchaseId: string;
  teacherId: string;
  teacherName: string;
  resourceId: string;
  resourceTitle: string;
  price: number | null;
  paymentProofUrl: string | null;
  aiPaymentNote: string | null;
  requestedAt: string;
};

// Daftar request beli bahan ajar yang lagi PENDING -- dipakai Owner/Admin
// buat approve/reject di halaman Materi.
export async function getPendingResourcePurchases(): Promise<PendingResourcePurchase[]> {
  const ctx = await getCallerContext();
  if (!ctx) return [];
  if (!ctx.roles.includes("OWNER") && !ctx.roles.includes("ADMIN")) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("teacher_resource_purchases")
    .select(
      "id, teacher_id, resource_id, payment_proof_url, ai_payment_note, requested_at, teachers:teacher_id (name), teacher_resources:resource_id (title, price)"
    )
    .eq("request_status", "PENDING")
    .order("requested_at", { ascending: true });

  return (data ?? []).map((row: any) => ({
    purchaseId: row.id,
    teacherId: row.teacher_id,
    teacherName: row.teachers?.name ?? "-",
    resourceId: row.resource_id,
    resourceTitle: row.teacher_resources?.title ?? "-",
    price: row.teacher_resources?.price ?? null,
    paymentProofUrl: row.payment_proof_url,
    aiPaymentNote: row.ai_payment_note,
    requestedAt: row.requested_at,
  }));
}

export async function approveResourcePurchase(purchaseId: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("OWNER") && !ctx.roles.includes("ADMIN")) {
    return { success: false, message: "Cuma Owner/Admin yang bisa approve request beli." };
  }

  const supabase = await createClient();
  const { data: purchase } = await supabase
    .from("teacher_resource_purchases")
    .select("id, request_status")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return { success: false, message: "Request tidak ditemukan." };
  if (purchase.request_status !== "PENDING") {
    return { success: false, message: "Request ini udah diproses sebelumnya." };
  }

  const { error } = await supabase
    .from("teacher_resource_purchases")
    .update({
      request_status: "APPROVED",
      status: "ACTIVE",
      reviewed_by_name: ctx.fullName,
      rejection_note: null,
    })
    .eq("id", purchaseId);
  if (error) return { success: false, message: error.message };

  revalidatePath("/materials", "layout");
  return { success: true, message: "Request beli disetujui." };
}

export async function rejectResourcePurchase(purchaseId: string, note: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("OWNER") && !ctx.roles.includes("ADMIN")) {
    return { success: false, message: "Cuma Owner/Admin yang bisa tolak request beli." };
  }

  const cleanedNote = note.trim();
  if (!cleanedNote) {
    return { success: false, message: "Kasih catatan alasan penolakan dulu buat Laoshi." };
  }

  const supabase = await createClient();
  const { data: purchase } = await supabase
    .from("teacher_resource_purchases")
    .select("id, request_status")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return { success: false, message: "Request tidak ditemukan." };
  if (purchase.request_status !== "PENDING") {
    return { success: false, message: "Request ini udah diproses sebelumnya." };
  }

  const { error } = await supabase
    .from("teacher_resource_purchases")
    .update({
      request_status: "REJECTED",
      status: "CANCELLED",
      rejection_note: cleanedNote,
      reviewed_by_name: ctx.fullName,
    })
    .eq("id", purchaseId);
  if (error) return { success: false, message: error.message };

  revalidatePath("/materials", "layout");
  return { success: true, message: "Request beli ditolak." };
}

// ============================================================
// Kirim Bahan Ajar (yang udah dibeli Laoshi) ke Murid -- Admin/Owner
// pilih kelas Laoshi yang mana aja (bisa lebih dari 1, Laoshi yang sama
// bisa dipake di beberapa kelas dia), materinya otomatis nongol di
// halaman Materi murid-murid kelas itu (nulis ke tabel `materials`,
// tabel yang sama yang dipakai murid buat lihat materi kelas). Ga ada
// status "kelas selesai" atau apapun -- Admin bisa kirim kapan aja.
// ============================================================

export type ResourceDeliveryClass = {
  classId: string;
  className: string;
  alreadySent: boolean;
};

export type ResourceDelivery = {
  purchaseId: string;
  resourceId: string;
  resourceTitle: string;
  resourceDescription: string | null;
  fileUrl: string;
  fileName: string | null;
  teacherId: string;
  teacherName: string;
  classes: ResourceDeliveryClass[];
};

// Daftar bahan ajar yang udah APPROVED dibeli Laoshi, lengkap sama daftar
// kelas Laoshi itu (buat Admin milih mau dikirim ke kelas mana) dan
// status "udah pernah dikirim" per kelas (biar Admin ga dobel-kirim
// tanpa sadar, tapi tetap bisa kalau emang mau).
export async function getResourceDeliveries(): Promise<ResourceDelivery[]> {
  const ctx = await getCallerContext();
  if (!ctx) return [];
  if (!ctx.roles.includes("OWNER") && !ctx.roles.includes("ADMIN")) return [];

  const supabase = await createClient();

  const { data: purchases } = await supabase
    .from("teacher_resource_purchases")
    .select(
      "id, teacher_id, resource_id, teachers:teacher_id (name), teacher_resources:resource_id (title, description, pdf_file_url, pdf_file_name)"
    )
    .eq("request_status", "APPROVED")
    .order("requested_at", { ascending: false });

  const rows = (purchases ?? []) as any[];
  if (rows.length === 0) return [];

  const teacherIds = Array.from(new Set(rows.map((r) => r.teacher_id).filter(Boolean)));

  const [{ data: classes }, { data: existingMaterials }] = await Promise.all([
    teacherIds.length
      ? supabase
          .from("classes")
          .select("id, name, teacher_id")
          .in("teacher_id", teacherIds)
          .order("name")
      : Promise.resolve({ data: [] }),
    teacherIds.length
      ? supabase
          .from("materials")
          .select("class_id, teacher_id, file_url")
          .in("teacher_id", teacherIds)
      : Promise.resolve({ data: [] }),
  ]);

  const classesByTeacher = new Map<string, { id: string; name: string }[]>();
  for (const c of classes ?? []) {
    const list = classesByTeacher.get(c.teacher_id) ?? [];
    list.push({ id: c.id, name: c.name });
    classesByTeacher.set(c.teacher_id, list);
  }

  const sentSet = new Set(
    (existingMaterials ?? []).map((m) => `${m.teacher_id}|${m.class_id}|${m.file_url}`)
  );

  return rows
    .filter((r) => r.teacher_resources && r.teachers)
    .map((r) => {
      const fileUrl = r.teacher_resources.pdf_file_url as string;
      const classesForTeacher = classesByTeacher.get(r.teacher_id) ?? [];
      return {
        purchaseId: r.id,
        resourceId: r.resource_id,
        resourceTitle: r.teacher_resources.title,
        resourceDescription: r.teacher_resources.description,
        fileUrl,
        fileName: r.teacher_resources.pdf_file_name,
        teacherId: r.teacher_id,
        teacherName: r.teachers.name ?? "-",
        classes: classesForTeacher.map((c) => ({
          classId: c.id,
          className: c.name,
          alreadySent: sentSet.has(`${r.teacher_id}|${c.id}|${fileUrl}`),
        })),
      };
    });
}

// Admin/Owner kirim 1 bahan ajar (yang udah dibeli & APPROVED) ke murid
// di kelas-kelas yang dipilih. Kelas WAJIB kelas Laoshi yang bersangkutan
// (dicek server-side, bukan cuma dari UI) -- kelas yang udah pernah
// dikirimin bahan ajar yang sama dilewatin otomatis, ga bikin dobel.
export async function sendResourceToClasses(purchaseId: string, classIds: string[]) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("OWNER") && !ctx.roles.includes("ADMIN")) {
    return { success: false, message: "Cuma Owner/Admin yang bisa kirim materi ke murid." };
  }

  const cleanedClassIds = Array.from(new Set(classIds.filter(Boolean)));
  if (cleanedClassIds.length === 0) {
    return { success: false, message: "Pilih minimal 1 kelas dulu." };
  }

  const supabase = await createClient();

  const { data: purchase } = await supabase
    .from("teacher_resource_purchases")
    .select("id, teacher_id, resource_id, request_status")
    .eq("id", purchaseId)
    .maybeSingle();
  if (!purchase) return { success: false, message: "Data pembelian tidak ditemukan." };
  if (purchase.request_status !== "APPROVED") {
    return { success: false, message: "Bahan ajar ini belum di-approve pembeliannya." };
  }

  const [{ data: resource }, { data: teacher }, { data: classes }] = await Promise.all([
    supabase
      .from("teacher_resources")
      .select("title, description, pdf_file_url, pdf_file_name")
      .eq("id", purchase.resource_id)
      .maybeSingle(),
    supabase.from("teachers").select("name").eq("id", purchase.teacher_id).maybeSingle(),
    supabase
      .from("classes")
      .select("id, name")
      .in("id", cleanedClassIds)
      .eq("teacher_id", purchase.teacher_id),
  ]);

  if (!resource) return { success: false, message: "Bahan ajar tidak ditemukan." };
  if (!classes || classes.length === 0) {
    return {
      success: false,
      message: "Kelas yang dipilih tidak valid buat Laoshi ini.",
    };
  }

  const { data: existingMaterials } = await supabase
    .from("materials")
    .select("class_id")
    .eq("teacher_id", purchase.teacher_id)
    .eq("file_url", resource.pdf_file_url)
    .in(
      "class_id",
      classes.map((c) => c.id)
    );

  const alreadySentClassIds = new Set((existingMaterials ?? []).map((m) => m.class_id));
  const classesToSend = classes.filter((c) => !alreadySentClassIds.has(c.id));

  if (classesToSend.length === 0) {
    return {
      success: false,
      message: "Semua kelas yang dipilih udah pernah dikirimin bahan ajar ini.",
    };
  }

  const rowsToInsert = classesToSend.map((c) => ({
    class_id: c.id,
    class_name: c.name,
    teacher_id: purchase.teacher_id,
    teacher_name: teacher?.name ?? null,
    title: resource.title,
    description: resource.description,
    file_url: resource.pdf_file_url,
    file_name: resource.pdf_file_name,
  }));

  const { error } = await supabase.from("materials").insert(rowsToInsert);
  if (error) return { success: false, message: error.message };

  revalidatePath("/materials", "layout");
  return {
    success: true,
    message: `Materi terkirim ke ${classesToSend.length} kelas.`,
  };
}
