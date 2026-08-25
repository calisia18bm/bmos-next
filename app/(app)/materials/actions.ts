"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getCallerContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("roles, teacher_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!myProfile) return null;
  return {
    roles: myProfile.roles || [],
    teacherId: myProfile.teacher_id as string | null,
    fullName: myProfile.full_name as string | null,
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
      message: "Akun kamu belum dihubungkan ke data Laoshi. Minta Owner buat hubungkan lewat halaman Accounts.",
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
