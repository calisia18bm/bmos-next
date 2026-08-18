import { BANNER_CATALOG } from "@/lib/characters";
import { getBannerLayout } from "./actions";
import BannerEditor from "./BannerEditor";

export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  const saved = await getBannerLayout();

  // Kalau belum pernah disimpan, mulai dari katalog default. Kalau item
  // katalog baru ditambahkan di kode tapi belum ada di layout tersimpan,
  // tetap dimasukkan di akhir supaya tidak "hilang".
  const initialItems = saved && saved.length > 0
    ? [
        ...saved,
        ...BANNER_CATALOG.filter((c) => !saved.some((s) => s.key === c.key)),
      ]
    : BANNER_CATALOG;

  return (
    <div>
      <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
        Settings
      </p>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-1">
        Atur Banner Home
      </h1>
      <p className="text-bmos-text-light text-sm mb-6">
        Atur ukuran & urutan logo/karakter yang muncul di sebelah &quot;Selamat
        datang&quot; pada halaman Home.
      </p>

      <BannerEditor initialItems={initialItems} />
    </div>
  );
}
