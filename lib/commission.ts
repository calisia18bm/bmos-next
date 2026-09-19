// Perhitungan potongan komisi BM dari harga kelas yang Laoshi tentukan
// sendiri. Tier-nya diatur Owner (disimpan di app_settings.commission_tiers),
// makin murah harga per paket, biasanya makin gede persen potongannya bisa
// diatur -- default di bawah ini cuma fallback kalau Owner belum pernah atur.

export type CommissionTier = { maxPrice: number | null; pct: number };

export const DEFAULT_COMMISSION_TIERS: CommissionTier[] = [
  { maxPrice: 100000, pct: 20 },
  { maxPrice: 200000, pct: 15 },
  { maxPrice: null, pct: 10 },
];

// tiers harus dibaca terurut dari maxPrice terkecil -> terbesar, baris
// terakhir biasanya maxPrice: null ("di atas semua tier lain").
export function computeCommission(
  price: number,
  tiers: CommissionTier[] = DEFAULT_COMMISSION_TIERS
) {
  const list = tiers.length > 0 ? tiers : DEFAULT_COMMISSION_TIERS;
  const sorted = [...list].sort((a, b) => {
    if (a.maxPrice === null) return 1;
    if (b.maxPrice === null) return -1;
    return a.maxPrice - b.maxPrice;
  });
  const tier =
    sorted.find((t) => t.maxPrice !== null && price <= t.maxPrice) ??
    sorted[sorted.length - 1];
  const pct = tier?.pct ?? 0;
  const cut = Math.round((price * pct) / 100);
  const net = price - cut;
  return { pct, cut, net };
}
