"use client";

import { useState } from "react";
import { syncSheetsNow } from "./actions";
import type { SyncResult } from "@/lib/sheetsExport";

export default function SyncButton({ disabled }: { disabled: boolean }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  async function handleClick() {
    setLoading(true);
    setResult(null);
    const r = await syncSheetsNow();
    setResult(r);
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading || disabled}
        className="bg-bmos-primary text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-50"
      >
        {loading ? "Menyinkronkan..." : "Sinkron Sekarang"}
      </button>

      {result && (
        <div
          className={`mt-4 rounded-2xl border p-4 text-sm ${
            result.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          <p className="font-semibold mb-2">{result.message}</p>
          {result.tabs.length > 0 && (
            <ul className="space-y-0.5">
              {result.tabs.map((t) => (
                <li key={t.tab}>
                  {t.tab}: {t.error ? `dilewati (${t.error})` : `${t.rows} baris`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
