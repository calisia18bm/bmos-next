// Daftar karakter maskot BM Mandarin yang bisa dipilih tiap user sebagai
// avatarnya sendiri (muncul di sidebar & dashboard).
export const CHARACTERS = [
  { key: "sunglasses_green", label: "Kacamata Item", file: "/characters/sunglasses_green.png" },
  { key: "magnifier_purple", label: "Kaca Pembesar", file: "/characters/magnifier_purple.png" },
  { key: "jiayou_orange", label: "Semangat", file: "/characters/jiayou_orange.png" },
  { key: "blanket_gray", label: "Selimutan", file: "/characters/blanket_gray.png" },
  { key: "coffee_yellow", label: "Santai Kopi", file: "/characters/coffee_yellow.png" },
  { key: "glasses_blue", label: "Kutu Buku", file: "/characters/glasses_blue.png" },
  { key: "brain_pink", label: "Pusing Mikir", file: "/characters/brain_pink.png" },
] as const;

export function getCharacterFile(key: string | null | undefined) {
  return CHARACTERS.find((c) => c.key === key)?.file || CHARACTERS[0].file;
}
