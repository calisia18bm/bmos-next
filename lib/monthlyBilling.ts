// Helper buat sistem billing bulanan Class Card -- dipisah dari
// commission.ts karena ini ngitung HARGA yang dibayar Murid, bukan
// potongan komisi BM (itu tetap dihitung dari harga per bulan yang
// sama, lewat computeCommission() di lib/commission.ts).

// Total yang perlu dibayar Murid buat 1 siklus pembayaran (1 bulan atau
// 3 bulan). Bayar 3 bulan sekaligus dapet diskon (three_month_discount_pct,
// diatur Laoshi pas bikin Class Card) dari harga 3x bulanan.
export function computeCycleAmount(
  monthlyPrice: number,
  cycleMonths: 1 | 3,
  threeMonthDiscountPct: number
): number {
  if (cycleMonths === 1) return monthlyPrice;
  const full = monthlyPrice * 3;
  const discount = Math.round((full * (threeMonthDiscountPct || 0)) / 100);
  return full - discount;
}

// Tanggal jatuh tempo BERIKUTNYA, dihitung dari tanggal bayar terakhir +
// jumlah bulan siklusnya. Dipakai pas approve pembayaran (join pertama
// maupun bayar lanjutan bulan berikutnya).
export function computeNextDueDate(fromDateIso: string, cycleMonths: number): string {
  const d = new Date(fromDateIso + "T00:00:00");
  d.setMonth(d.getMonth() + cycleMonths);
  return d.toISOString().slice(0, 10);
}

export function formatCycleLabel(cycleMonths: number): string {
  return cycleMonths === 3 ? "3 bulan sekaligus" : "per bulan";
}
