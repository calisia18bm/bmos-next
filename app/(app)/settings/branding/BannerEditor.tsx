"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BannerItem } from "@/lib/characters";
import { saveBannerLayout } from "./actions";

export default function BannerEditor({ initialItems }: { initialItems: BannerItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<BannerItem[]>(initialItems);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function updateHeight(key: string, heightPx: number) {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, heightPx } : it))
    );
  }

  function move(key: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.key === key);
      const swapIdx = idx + dir;
      if (idx === -1 || swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const result = await saveBannerLayout(items);
    setSaving(false);
    setMessage(result.message);
    if (result.success) router.refresh();
  }

  return (
    <div>
      {/* Preview */}
      <div className="bg-white border border-bmos-border rounded-2xl p-6 mb-6">
        <p className="text-xs font-bold tracking-wide text-bmos-text-light uppercase mb-3">
          Preview
        </p>
        <div className="flex items-end gap-1.5 flex-wrap bg-bmos-bg rounded-xl p-4 min-h-[100px]">
          {items.map((it) => (
            <Image
              key={it.key}
              src={it.file}
              alt={it.label}
              width={it.heightPx * 1.4}
              height={it.heightPx}
              style={{ height: it.heightPx }}
              className="w-auto object-contain"
            />
          ))}
        </div>
      </div>

      {/* Editor list */}
      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-bmos-border">
          <h2 className="font-bold text-bmos-text">Atur Tiap Item</h2>
        </div>
        <div className="divide-y divide-bmos-border">
          {items.map((it, i) => (
            <div key={it.key} className="px-5 py-3 flex items-center gap-4">
              <div className="w-14 h-14 flex items-center justify-center bg-bmos-bg rounded-xl shrink-0">
                <Image
                  src={it.file}
                  alt={it.label}
                  width={48}
                  height={48}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <p className="flex-1 text-sm font-semibold text-bmos-text">{it.label}</p>
              <div className="flex items-center gap-2">
                <label className="text-xs text-bmos-text-light">Ukuran (px)</label>
                <input
                  type="number"
                  min={16}
                  max={160}
                  value={it.heightPx}
                  onChange={(e) => updateHeight(it.key, Number(e.target.value) || 0)}
                  className="w-20 border border-bmos-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(it.key, -1)}
                  disabled={i === 0}
                  className="w-8 h-8 rounded-lg border border-bmos-border text-bmos-text hover:bg-bmos-primary-soft disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Geser ke kiri"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(it.key, 1)}
                  disabled={i === items.length - 1}
                  className="w-8 h-8 rounded-lg border border-bmos-border text-bmos-text hover:bg-bmos-primary-soft disabled:opacity-30 disabled:hover:bg-transparent"
                  title="Geser ke kanan"
                >
                  →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-bmos-primary text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
        >
          {saving ? "Menyimpan..." : "Simpan Layout"}
        </button>
        {message && <p className="text-sm text-bmos-text-light">{message}</p>}
      </div>
    </div>
  );
}
