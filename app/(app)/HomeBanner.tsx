"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BannerItem, defaultBannerPositions } from "@/lib/characters";
import { saveBannerLayout } from "./settings/branding/actions";

const CONTAINER_HEIGHT = 130;
// Lebar maksimum area banner -- item ga boleh digeser sampai keluar dari
// batas ini, biar ga ada karakter yang "ilang" kepotong di luar layar.
const CONTAINER_MAX_WIDTH = 480;

function clampItem(it: BannerItem): BannerItem {
  const itemWidth = it.heightPx * 1.4;
  const maxX = Math.max(0, CONTAINER_MAX_WIDTH - itemWidth);
  const maxY = Math.max(0, CONTAINER_HEIGHT - it.heightPx);
  return {
    ...it,
    x: Math.min(Math.max(it.x ?? 0, 0), maxX),
    y: Math.min(Math.max(it.y ?? 0, 0), maxY),
  };
}

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
    defaultBannerPositions(items).map(clampItem)
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
    setLocalItems((prev) =>
      prev.map((it) =>
        it.key === key
          ? clampItem({ ...it, x: origX + dx, y: origY + dy })
          : it
      )
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
    setLocalItems(defaultBannerPositions(items).map(clampItem));
    setEditMode(false);
  }

  return (
    <div className="shrink-0">
      {canEdit && (
        <div className="flex justify-end mb-1">
          {!editMode ? (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="text-xs font-semibold text-bmos-primary hover:underline"
            >
              Atur posisi & ukuran
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-bmos-text-light">
                Tarik buat geser
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
            </div>
          )}
        </div>
      )}
      <div
        ref={containerRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`relative ${editMode ? "border-2 border-dashed border-bmos-primary-light rounded-xl bg-bmos-primary-soft/10" : ""}`}
        style={{ height: CONTAINER_HEIGHT, width: CONTAINER_MAX_WIDTH, maxWidth: "100%" }}
      >
        {localItems.map((it) => (
          <div
            key={it.key}
            onPointerDown={(e) => onPointerDown(e, it.key)}
            className={`absolute ${editMode ? "cursor-move select-none" : ""}`}
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
    </div>
  );
}
