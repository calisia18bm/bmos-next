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

// Semua elemen yang bisa muncul di banner dashboard Home (logo + karakter),
// dipakai sbg katalog default buat halaman "Atur Banner". Owner bisa ubah
// ukuran & urutannya sendiri lewat halaman itu -- hasilnya disimpan di
// app_settings.banner_layout (lihat database/add_banner_layout.sql).
export type BannerItem = {
  key: string;
  label: string;
  file: string;
  heightPx: number;
  // Posisi bebas (geser tarik) di dalam area banner Home, dalam px relatif
  // ke pojok kiri-atas area banner. Kalau belum pernah diatur (undefined),
  // dipakai urutan baris default (lihat defaultBannerPositions()).
  x?: number;
  y?: number;
};

// Susun posisi default buat item yang BELUM PERNAH digeser manual (belum
// punya x/y tersimpan). Item yang UDAH punya x/y tersimpan (misal karakter
// yang udah diatur Owner ke kanan-atas) sama sekali ga disentuh/dipindah.
// Item baru yang belum pernah diatur (misal logo yang baru ditambah ke
// katalog) ditaruh NEMPEL DI SEBELAH item yang udah ada posisinya -- biar
// keliatan "gabung" ke baris yang sama, bukan nongol sendiri di pojok
// lain. Kalau belum ada satupun item yang punya posisi tersimpan (akun
// baru, belum pernah diatur sama sekali), baru dipakai fallback nempel
// pojok kiri-bawah layar.
export function defaultBannerPositions(items: BannerItem[]): BannerItem[] {
  const positioned = items.filter(
    (it) => typeof it.x === "number" && typeof it.y === "number"
  );
  const missing = items.filter(
    (it) => !(typeof it.x === "number" && typeof it.y === "number")
  );
  if (missing.length === 0) return items;

  let x: number;
  let y: number;
  if (positioned.length > 0) {
    const rightmost = positioned.reduce((max, it) =>
      (it.x ?? 0) + it.heightPx * 1.4 > (max.x ?? 0) + max.heightPx * 1.4
        ? it
        : max
    );
    x = (rightmost.x ?? 0) + rightmost.heightPx * 1.4 + 6;
    y = rightmost.y ?? 0;
  } else {
    const rowHeight = Math.max(...missing.map((it) => it.heightPx), 40);
    const viewportHeight =
      typeof window !== "undefined" ? window.innerHeight : 800;
    x = 16;
    y = Math.max(16, viewportHeight - rowHeight - 24);
  }

  return items.map((it) => {
    if (typeof it.x === "number" && typeof it.y === "number") return it;
    const withPos = { ...it, x, y };
    x += it.heightPx * 1.4 + 6;
    return withPos;
  });
}

export const BANNER_CATALOG: BannerItem[] = [
  { key: "bm_logo", label: "Logo BM", file: "/characters/bm_logo.png", heightPx: 40 },
  { key: "xuebao_logo", label: "Logo xuebao", file: "/characters/xuebao_logo.png", heightPx: 36 },
  ...CHARACTERS.map((c) => ({ key: c.key, label: c.label, file: c.file, heightPx: 64 })),
];
