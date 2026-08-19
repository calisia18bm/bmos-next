"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BannerItem, defaultBannerPositions } from "@/lib/characters";
import { saveBannerLayout } from "./settings/branding/actions";

export default function HomeBanner({
  items,
  canEdit,
}: {
  items: BannerItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editMode, setEditMode] = useState(false);
  const [localItems, setLocalItems] = useState<BannerItem[]>(
    defaultBannerPositions(items)
  );
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    key: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  function onPointerDown(e: React.PointerEvent, key: string) {
    if (!editMode) return;
    const item = localItems.find((it) => it.key === key);
    if (!item) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = {
      key,
      startX: e.clientX,
      startY: e.clientY,
      origX: item.x ?? 0,
      origY: item.y ?? 0,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragState.current) return;
    const { key, startX, startY, origX, origY } = dragState.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    // Batas gesernya ngikutin ukuran area sebenarnya (seluruh halaman
    // Home), diukur langsung dari DOM -- jadi item ga bisa "ilang" keluar
    // dari area, tapi bebas ditaruh dimana aja di dalamnya.
    const rect = containerRef.current?.getBoundingClientRect();
    const maxW = rect ? rect.width : Infinity;
    const maxH = rect ? rect.height : Infinity;
    setLocalItems((prev) =>
      prev.map((it) => {
        if (it.key !== key) return it;
        const itemWidth = it.heightPx * 1.4;
        const maxX = Math.max(0, maxW - itemWidth);
        const maxY = Math.max(0, maxH - it.heightPx);
        return {
          ...it,
          x: Math.min(Math.max(origX + dx, 0), maxX),
          y: Math.min(Math.max(origY + dy, 0), maxY),
        };
      })
    );
  }

  function onPointerUp() {
    dragState.current = null;
  }

  async function handleSave() {
    setSaving(true);
    await saveBannerLayout(localItems);
    setSaving(false);
    setEditMode(false);
    router.refresh();
  }

  function handleCancel() {
    setLocalItems(defaultBannerPositions(items));
    setEditMode(false);
  }

  return (
    <>
      {canEdit && (
        <div className="fixed top-4 right-6 z-50 flex items-center gap-3 bg-white/95 backdrop-blur border border-bmos-border rounded-xl px-3 py-2 shadow-sm">
          {!editMode ? (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="text-xs font-semibold text-bmos-primary hover:underline"
            >
              Atur posisi karakter
            </button>
          ) : (
            <>
              <span className="text-xs text-bmos-text-light">
                Tarik buat geser, taruh dimana aja
              </span>
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs text-bmos-text-light hover:text-bmos-text"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="text-xs font-semibold bg-bmos-primary text-white rounded-lg px-3 py-1.5 hover:bg-bmos-primary-light disabled:opacity-60"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </>
          )}
        </div>
      )}
      {/* Area geser menutupi seluruh halaman Home -- item bisa ditaruh
          dimana aja di dalam halaman, ga cuma di satu kotak kecil. */}
      <div
        ref={containerRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`absolute inset-0 ${
          editMode
            ? "pointer-events-auto border-2 border-dashed border-bmos-primary-light rounded-xl bg-bmos-primary-soft/5 z-40"
            : "pointer-events-none"
        }`}
      >
        {localItems.map((it) => (
          <div
            key={it.key}
            onPointerDown={(e) => onPointerDown(e, it.key)}
            className={`absolute ${
              editMode ? "cursor-move select-none pointer-events-auto" : ""
            }`}
            style={{ left: it.x, top: it.y }}
          >
            <Image
              src={it.file}
              alt={it.label}
              width={it.heightPx * 1.4}
              height={it.heightPx}
              style={{ height: it.heightPx }}
              className="w-auto object-contain pointer-events-none"
              draggable={false}
            />
          </div>
        ))}
      </div>
    </>
  );
}
