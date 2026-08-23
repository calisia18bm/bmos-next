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
// (HSK, latihan ngobrol bareng orang China, dll).
export const GOAL_TAGS = [
  { key: "HSK1", label: "HSK 1" },
  { key: "HSK2", label: "HSK 2" },
  { key: "HSK3", label: "HSK 3" },
  { key: "HSK4", label: "HSK 4" },
  { key: "HSK5", label: "HSK 5" },
  { key: "HSK6", label: "HSK 6" },
  { key: "PERCAKAPAN", label: "Percakapan Sehari-hari" },
  { key: "CHINA_BUDDY", label: "Pasangan Bicara / China Buddy" },
  { key: "BISNIS", label: "Mandarin Bisnis" },
  { key: "ANAK", label: "Anak-anak" },
  { key: "SEKOLAH", label: "Persiapan Sekolah / Ujian" },
] as const;

export function goalTagLabel(key: string): string {
  return GOAL_TAGS.find((g) => g.key === key)?.label ?? key;
}

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
