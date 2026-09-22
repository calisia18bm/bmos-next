// Status pembayaran Murid -- nilai MENTAH yang kesimpen di kolom
// students.payment_status TETAP sama kayak dari awal (AKTIF / JATUH
// TEMPO / NON-AKTIF, lihat database/schema.sql), CUMA tulisan yang
// ditampilin ke user yang diganti biar lebih jelas maksudnya:
//   AKTIF       -> "Sudah Bayar"
//   JATUH TEMPO -> "Jatuh Tempo"
//   NON-AKTIF   -> "Belum Bayar" (dipakai juga buat murid baru yang
//                  belum pernah bayar sama sekali)
//
// Dipakai bareng di halaman Home Murid, Murid Saya (Laoshi), detail
// Murid (BM), Pembayaran Saya (Murid), & dropdown edit Murid (BM).
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  AKTIF: "Sudah Bayar",
  "JATUH TEMPO": "Jatuh Tempo",
  "NON-AKTIF": "Belum Bayar",
};

export function paymentStatusLabel(raw: string | null | undefined): string {
  if (!raw) return "-";
  return PAYMENT_STATUS_LABEL[raw] || raw;
}

export const PAYMENT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "NON-AKTIF", label: "Belum Bayar" },
  { value: "AKTIF", label: "Sudah Bayar" },
  { value: "JATUH TEMPO", label: "Jatuh Tempo" },
];
