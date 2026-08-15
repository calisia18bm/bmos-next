"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function WeekNavigator({
  weekLabel,
  dateRangeLabel,
}: {
  weekLabel: string;
  dateRangeLabel: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const offset = Number(searchParams.get("week") || "0");

  function goTo(newOffset: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (newOffset === 0) {
      params.delete("week");
    } else {
      params.set("week", String(newOffset));
    }
    router.push(`/weekly-schedule?${params.toString()}`);
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
