"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { readPaymentProofWithAI } from "@/lib/paymentProof";

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

// Laoshi cuma boleh upload ke kelas yang dia ajar sendiri. Owner/Admin
// boleh upload ke kelas mana aja.
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
  const isTeacher = ctx.roles.includes("TEACHER");

  if (!isStaff && !isTeacher) {
    return { success: false, message: "Kamu ga punya akses upload materi." };
  }

  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, teacher_id, teacher_name")
    .eq("id", input.classId)
    .maybeSingle();

  if (!cls) return { success: false, message: "Kelas tidak ditemukan." };

  if (!isStaff && cls.teacher_id !== ctx.teacherId) {
    return {
      success: false,
      message: "Kamu cuma bisa upload materi ke kelas yang kamu ajar.",
    };
  }

  const title = input.title.trim();
  if (!title) return { success: false, message: "Judul materi wajib diisi." };

  const { error } = await supabase.from("materials").insert({
    class_id: cls.id,
    class_name: cls.name,
    teacher_id: isTeacher ? ctx.teacherId : cls.teacher_id,
    teacher_name: isTeacher ? ctx.fullName : cls.teacher_name,
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
  const isOwnUpload =
    ctx.roles.includes("TEACHER") && material.teacher_id === ctx.teacherId;

  if (!isStaff && !isOwnUpload) {
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
// Submit Materi dari Laoshi -> direview Admin/Owner -> dipublish balik
// jadi PDF di teacher_resources (bisa dipakai SEMUA Laoshi).
// ============================================================
export async function submitTeacherResourceDraft(input: {
  title: string;
  description: string;
  fileUrl: string;
  fileName: string;
  filePath: string;
}) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };

  const isTeacher = ctx.roles.includes("TEACHER");
  if (!isTeacher) {
    return { success: false, message: "Cuma Laoshi yang bisa submit materi buat direview." };
  }
  if (!ctx.teacherId) {
    return {
      success: false,
      message: "Akun belum selesai diverifikasi, hubungi admin.",
    };
  }

  const title = input.title.trim();
  if (!title) return { success: false, message: "Judul materi wajib diisi." };
  if (!input.fileUrl) return { success: false, message: "File materi wajib diupload." };

  const supabase = await createClient();
  const { error } = await supabase.from("teacher_resource_submissions").insert({
    teacher_id: ctx.teacherId,
    teacher_name: ctx.fullName,
    title,
    description: input.description.trim() || null,
    submitted_file_url: input.fileUrl,
    submitted_file_name: input.fileName,
    submitted_file_path: input.filePath,
    status: "PENDING",
  });

  if (error) return { success: false, message: error.message };

  revalidatePath("/materials", "layout");
  return { success: true, message: "Materi berhasil disubmit, menunggu review Admin/Owner." };
}

// Owner/Admin approve submission -- WAJIB upload versi PDF final, yang
// otomatis dipublish ke teacher_resources (jadi bisa dipakai semua Laoshi,
// bukan cuma yang submit).
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
      message: "Kamu udah punya request beli buat bahan ajar ini, tunggu di-review Admin ya.",
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

  revalidatePath("/materials", "layout");
  return {
    success: true,
    message: `Request beli "${resource.title}" terkirim, tunggu di-review Admin ya.`,
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
