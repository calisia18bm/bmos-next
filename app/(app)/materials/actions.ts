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
