import Image from "next/image";

// Logo BM Mandarin nempel statis di pojok kiri-bawah layar di SEMUA
// halaman (bukan cuma Home) -- ditaruh di app layout (bukan di HomeBanner
// lagi) biar keliatan terus dimanapun user lagi buka. Background bulat
// putih ditambahin di belakangnya biar logonya tetep keliatan jelas di
// atas warna sidebar yang sekarang gelap (marun).
const BM_LOGO_LEFT_PX = 170;
const BM_LOGO_BOTTOM_PX = 80;

export default function BmLogoBadge() {
  return (
    <div
      className="fixed z-30 w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center overflow-hidden pointer-events-none"
      style={{ left: BM_LOGO_LEFT_PX, bottom: BM_LOGO_BOTTOM_PX }}
    >
      <Image
        src="/characters/bm_logo.png"
        alt="Logo BM Mandarin"
        width={56}
        height={56}
        className="w-full h-full object-cover"
        draggable={false}
      />
    </div>
  );
}
