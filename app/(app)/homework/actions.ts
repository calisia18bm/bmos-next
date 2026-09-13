"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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

// Laoshi bikin PR buat kelas yang dia ajar sendiri (Owner/Admin boleh
// buat kelas mana aja, buat bantu/oversight).
export async function createHomework(input: {
  classId: string;
  title: string;
  description: string;
  dueDate: string;
}) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };

  const isStaff = ctx.roles.includes("OWNER") || ctx.roles.includes("ADMIN");
  const isTeacher = ctx.roles.includes("TEACHER");
  if (!isStaff && !isTeacher) {
    return { success: false, message: "Kamu ga punya akses bikin PR." };
  }

  const title = input.title.trim();
  if (!title) return { success: false, message: "Judul PR wajib diisi." };

  const supabase = await createClient();
  const { data: cls } = await supabase
    .from("classes")
    .select("id, name, teacher_id, teacher_name")
    .eq("id", input.classId)
    .maybeSingle();

  if (!cls) return { success: false, message: "Kelas tidak ditemukan." };
  if (!isStaff && cls.teacher_id !== ctx.teacherId) {
    return { success: false, message: "Kamu cuma bisa bikin PR buat kelas yang kamu ajar." };
  }

  const { error } = await supabase.from("homework").insert({
    class_id: cls.id,
    class_name: cls.name,
    teacher_id: isTeacher ? ctx.teacherId : cls.teacher_id,
    teacher_name: isTeacher ? ctx.fullName : cls.teacher_name,
    title,
    description: input.description.trim() || null,
    due_date: input.dueDate || null,
  });

  if (error) return { success: false, message: error.message };

  revalidatePath("/homework", "layout");
  return { success: true, message: "PR berhasil dibuat." };
}

export async function deleteHomework(id: string) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };

  const supabase = await createClient();
  const { data: hw } = await supabase
    .from("homework")
    .select("id, teacher_id")
    .eq("id", id)
    .maybeSingle();

  if (!hw) return { success: false, message: "PR tidak ditemukan." };

  const isStaff = ctx.roles.includes("OWNER") || ctx.roles.includes("ADMIN");
  const isOwnHomework = ctx.roles.includes("TEACHER") && hw.teacher_id === ctx.teacherId;
  if (!isStaff && !isOwnHomework) {
    return { success: false, message: "Kamu ga punya akses hapus PR ini." };
  }

  // Submission & filenya dibiarin (riwayat), cuma PR-nya yang dihapus.
  const { error } = await supabase.from("homework").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/homework", "layout");
  return { success: true, message: "PR dihapus." };
}

// Murid submit jawaban PR -- submit ulang bakal nimpa jawaban lama
// (upsert berdasarkan homework_id + student_id).
export async function submitHomework(input: {
  homeworkId: string;
  submissionType: "TEXT" | "AUDIO" | "VIDEO" | "FILE";
  answerText: string;
  fileUrl: string;
  fileName: string;
  filePath: string;
}) {
  const ctx = await getCallerContext();
  if (!ctx) return { success: false, message: "Belum login." };
  if (!ctx.roles.includes("STUDENT") || !ctx.studentId) {
    return { success: false, message: "Cuma akun Murid yang bisa submit PR." };
  }

  if (input.submissionType === "TEXT" && !input.answerText.trim()) {
    return { success: false, message: "Jawaban teks wajib diisi." };
  }
  if (input.submissionType !== "TEXT" && !input.fileUrl) {
    return { success: false, message: "File wajib diupload." };
  }

  const supabase = await createClient();

  const { data: hw } = await supabase
    .from("homework")
    .select("id, class_id")
    .eq("id", input.homeworkId)
    .maybeSingle();
  if (!hw) return { success: false, message: "PR tidak ditemukan." };

  const { data: student } = await supabase
    .from("students")
    .select("id, class_id, name")
    .eq("id", ctx.studentId)
    .maybeSingle();
  if (!student) return { success: false, message: "Data murid tidak ditemukan." };
  if (student.class_id !== hw.class_id) {
    return { success: false, message: "PR ini bukan buat kelas kamu." };
  }

  const { error } = await supabase.from("homework_submissions").upsert(
    {
      homework_id: hw.id,
      student_id: student.id,
      student_name: student.name,
      submission_type: input.submissionType,
      answer_text: input.submissionType === "TEXT" ? input.answerText.trim() : null,
      file_url: input.fileUrl || null,
      file_name: input.fileName || null,
      file_path: input.filePath || null,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "homework_id,student_id" }
  );

  if (error) return { success: false, message: error.message };

  revalidatePath("/homework", "layout");
  return { success: true, message: "Jawaban PR berhasil disubmit." };
}
