// Katalog & tipe buat fitur "Kelas by Card" -- Laoshi bikin kartu kelas
// sendiri (nama, jadwal, harga, kuota, tujuan belajar), submit buat
// di-approve Owner, baru Murid bisa lihat & join dari kartunya.

export const CLASS_DAYS = [
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

// Badge tujuan belajar yang bisa dipilih Laoshi pas bikin kelas -- muncul
// di kartu kelas biar Murid gampang nemuin kelas yang sesuai tujuan dia
// (HSK, latihan ngobrol bareng orang China, dll). Daftarnya sekarang
// diatur OWNER sendiri (disimpan di app_settings.goal_tags, lihat
// getGoalTags/saveGoalTags di app/(app)/class-cards/actions.ts) -- ini
// cuma fallback awal kalau Owner belum pernah atur.
export const DEFAULT_GOAL_TAGS = [
  "HSK 1",
  "HSK 2",
  "HSK 3",
  "HSK 4",
  "HSK 5",
  "HSK 6",
  "Percakapan Sehari-hari",
  "Pasangan Bicara / China Buddy",
  "Mandarin Bisnis",
  "Anak-anak",
  "Persiapan Sekolah / Ujian",
];

export type ClassCardStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

export type ClassCard = {
  id: string;
  class_code: string;
  name: string;
  description: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  created_by_teacher_id: string | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  capacity_max: number;
  is_private: boolean;
  registration_start: string | null;
  registration_end: string | null;
  price: number | null;
  sessions_count: number | null;
  goal_tags: string[] | null;
  approval_status: ClassCardStatus;
  rejection_note: string | null;
  ai_note: string | null;
  active: boolean;
  registration_open: boolean;
  created_at: string;
};

export function formatRupiah(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return `Rp ${n.toLocaleString("id-ID")}`;
}
