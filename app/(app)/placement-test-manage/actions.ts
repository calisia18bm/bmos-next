"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireOwnerOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Belum login." };

  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .maybeSingle();

  const roles = (myProfile?.roles || []) as string[];
  if (!roles.includes("OWNER") && !roles.includes("ADMIN")) {
    return { ok: false as const, message: "Cuma Owner/Admin yang bisa atur soal placement test." };
  }
  return { ok: true as const };
}

export async function createQuestion(input: {
  questionText: string;
  options: string[];
  correctIndex: number;
  orderIndex: number;
}) {
  const check = await requireOwnerOrAdmin();
  if (!check.ok) return { success: false, message: check.message };

  const questionText = input.questionText.trim();
  const options = input.options.map((o) => o.trim()).filter((o) => o.length > 0);
  if (!questionText) return { success: false, message: "Pertanyaan wajib diisi." };
  if (options.length < 2) return { success: false, message: "Minimal 2 pilihan jawaban." };
  if (input.correctIndex < 0 || input.correctIndex >= options.length) {
    return { success: false, message: "Pilih jawaban yang bener dulu." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("placement_test_questions").insert({
    question_text: questionText,
    options,
    correct_index: input.correctIndex,
    order_index: input.orderIndex,
  });

  if (error) return { success: false, message: error.message };

  revalidatePath("/placement-test-manage", "layout");
  revalidatePath("/placement-test");
  return { success: true, message: "Soal berhasil ditambah." };
}

export async function updateQuestion(
  id: string,
  input: { questionText: string; options: string[]; correctIndex: number; orderIndex: number }
) {
  const check = await requireOwnerOrAdmin();
  if (!check.ok) return { success: false, message: check.message };

  const questionText = input.questionText.trim();
  const options = input.options.map((o) => o.trim()).filter((o) => o.length > 0);
  if (!questionText) return { success: false, message: "Pertanyaan wajib diisi." };
  if (options.length < 2) return { success: false, message: "Minimal 2 pilihan jawaban." };
  if (input.correctIndex < 0 || input.correctIndex >= options.length) {
    return { success: false, message: "Pilih jawaban yang bener dulu." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("placement_test_questions")
    .update({
      question_text: questionText,
      options,
      correct_index: input.correctIndex,
      order_index: input.orderIndex,
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/placement-test-manage", "layout");
  revalidatePath("/placement-test");
  return { success: true, message: "Soal berhasil diupdate." };
}

export async function deleteQuestion(id: string) {
  const check = await requireOwnerOrAdmin();
  if (!check.ok) return { success: false, message: check.message };

  const supabase = await createClient();
  const { error } = await supabase.from("placement_test_questions").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/placement-test-manage", "layout");
  revalidatePath("/placement-test");
  return { success: true, message: "Soal dihapus." };
}
