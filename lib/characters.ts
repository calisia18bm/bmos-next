// Daftar karakter maskot BM Mandarin yang bisa dipilih tiap user sebagai
// avatarnya sendiri (muncul di sidebar & dashboard).
//
// heightPx dihitung dari luas asli tiap gambar (bukan cuma tingginya),
// soalnya proporsi tiap karakter beda -- ada yang berdiri tinggi-kurus,
// ada yang duduk gempal melebar. Kalau disamain tingginya doang, yang
// gempal (contoh: Santai Kopi, Selimutan) keliatan lebih kecil biarpun
// filenya udah dipotong rapat. Angka ini bikin luas tampil di layar
// kurang lebih sama rata buat semua karakter.
export const CHARACTERS = [
  { key: "sunglasses_green", label: "Kacamata Item", file: "/characters/sunglasses_green.png", heightPx: 73 },
  { key: "magnifier_purple", label: "Kaca Pembesar", file: "/characters/magnifier_purple.png", heightPx: 72 },
  { key: "jiayou_orange", label: "Semangat", file: "/characters/jiayou_orange.png", heightPx: 78 },
  { key: "blanket_gray", label: "Selimutan", file: "/characters/blanket_gray.png", heightPx: 66 },
  { key: "coffee_yellow", label: "Santai Kopi", file: "/characters/coffee_yellow.png", heightPx: 67 },
  { key: "glasses_blue", label: "Kutu Buku", file: "/characters/glasses_blue.png", heightPx: 72 },
  { key: "brain_pink", label: "Pusing Mikir", file: "/characters/brain_pink.png", heightPx: 76 },
] as const;

export function getCharacterFile(key: string | null | undefined) {
  return CHARACTERS.find((c) => c.key === key)?.file || CHARACTERS[0].file;
}
