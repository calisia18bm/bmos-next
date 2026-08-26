"use server";

import { createClient } from "@/lib/supabase/server";

// Nentuin saran level dari persentase jawaban bener -- sederhana, bisa
// disesuaikan lagi nanti kalau Owner mau tier yang beda.
function suggestLevel(pct: number): string {
  if (pct >= 90) return "Mahir (Lanjutan)";
  if (pct >= 70) return "Menengah";
  if (pct >= 40) return "Dasar";
  return "Pemula";
}

// Publik -- BISA dipanggil tanpa login (calon murid isi test dari
// halaman /placement-test). Skornya dihitung ULANG di server dari
// jawaban yang bener di database, BUKAN percaya angka dari client, biar
// ga bisa dimanipulasi.
export async function submitPlacementTest(input: {
  name: string;
  phone: string;
  email: string;
  answers: (number | null)[];
}) {
  const name = input.name.trim();
  if (!name) return { success: false, message: "Nama wajib diisi." };

  const supabase = await createClient();
  const { data: questions } = await supabase
    .from("placement_test_questions")
    .select("id, correct_index, points")
    .order("order_index", { ascending: true });

  if (!questions || questions.length === 0) {
    return { success: false, message: "Soal placement test belum tersedia." };
  }

  // Tiap soal bisa punya poin beda-beda (diatur Owner/Admin) -- skor
  // akhir dihitung dari total poin soal yang dijawab bener dibagi total
  // poin semua soal, BUKAN sekadar jumlah soal bener (biar soal yang
  // dikasih poin lebih gede beneran ngaruh ke skor akhir).
  let earnedPoints = 0;
  let totalPoints = 0;
  questions.forEach((q, i) => {
    const pts = q.points ?? 1;
    totalPoints += pts;
    if (input.answers[i] === q.correct_index) earnedPoints += pts;
  });

  const total = questions.length;
  const pct = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const levelSuggestion = suggestLevel(pct);

  const { error } = await supabase.from("placement_test_results").insert({
    name,
    phone: input.phone.trim() || null,
    email: input.email.trim() || null,
    answers: input.answers,
    score: earnedPoints,
    total_questions: total,
    total_points: totalPoints,
    level_suggestion: levelSuggestion,
  });

  if (error) return { success: false, message: error.message };

  return {
    success: true,
    message: "Placement test berhasil disubmit.",
    score: earnedPoints,
    total: totalPoints,
    levelSuggestion,
  };
}
