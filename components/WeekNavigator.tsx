"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Versi generic dari WeekNavigator punya Owner (app/(app)/weekly-schedule) --
// bedanya ini otomatis nempel ke halaman mana aja (pakai usePathname),
// dan tetap mempertahankan query param lain yang udah ada di URL (misal
// ?teacherId=... / ?studentId=... dari OwnerPreviewPicker), jadi pas
// pindah minggu, Laoshi/Murid yang lagi dipilih ga ke-reset.
export default function WeekNavigator({
  weekLabel,
  dateRangeLabel,
}: {
  weekLabel: string;
  dateRangeLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const offset = Number(searchParams.get("week") || "0");

  function goTo(newOffset: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newOffset === 0) {
      params.delete("week");
    } else {
      params.set("week", String(newOffset));
    }
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => goTo(offset - 1)}
        className="w-9 h-9 rounded-xl border border-bmos-border bg-white hover:bg-bmos-primary-soft flex items-center justify-center"
      >
        ‹
      </button>
      <div className="text-center min-w-[160px]">
        <p className="font-bold text-bmos-text text-sm">{weekLabel}</p>
        <p className="text-xs text-bmos-text-light">{dateRangeLabel}</p>
      </div>
      <button
        onClick={() => goTo(offset + 1)}
        className="w-9 h-9 rounded-xl border border-bmos-border bg-white hover:bg-bmos-primary-soft flex items-center justify-center"
      >
        ›
      </button>
      {offset !== 0 && (
        <button
          onClick={() => goTo(0)}
          className="text-xs font-semibold text-bmos-primary hover:underline"
        >
          Hari Ini
        </button>
      )}
    </div>
  );
}
