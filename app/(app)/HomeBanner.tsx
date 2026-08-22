"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BannerItem, defaultBannerPositions } from "@/lib/characters";
import { saveBannerLayout } from "./settings/branding/actions";

// Logo BM SELALU nempel statis di pojok kiri-bawah layar (di sebelah
// kanan tombol "Keluar" di sidebar, biar ga numpuk sama tulisannya) --
// beda sama karakter maskot yang bisa digeser bebas sama Owner. Logo
// xuebao IKUT gabung ke baris karakter (lihat draggableItems di bawah),
// bukan statis, sesuai permintaan biar tetep "di samping karakter".
const STATIC_BOTTOM_LEFT_KEYS = new Set(["bm_logo"]);
// Digeser ke kanan & sedikit ke atas dari pojok kiri-bawah sidebar, biar
// ga numpuk tulisan email/OWNER/Keluar di footer sidebar -- tetap di
// dalam kotak footer itu, cuma dipindah ke bagian yang kosong.
const BM_LOGO_LEFT_PX = 170;
const BM_LOGO_BOTTOM_PX = 80;

export default function HomeBanner({
  items,
  canEdit,
}: {
  items: BannerItem[];
  canEdit: boolean;
}) {
  const router = useRouter();

  const logoItems = items.filter((it) => STATIC_BOTTOM_LEFT_KEYS.has(it.key));
  const draggableItems = items.filter(
    (it) => !STATIC_BOTTOM_LEFT_KEYS.has(it.key)
  );

  const [editMode, setEditMode] = useState(false);
  // Kalau Owner belum pernah nyimpen posisi custom buat karakter (belum
  // ada x/y), tampilannya BUKAN pakai absolute positioning full-layar --
  // cukup baris kecil rapi nempel pojok kiri-bawah layar. Begitu Owner
  // udah pernah nyimpen posisi (misal digeser ke kanan-atas), posisi itu
  // yang dipertahankan terus.
  const hasSavedLayout = draggableItems.some((it) => typeof it.x === "number");
  const [localItems, setLocalItems] = useState<BannerItem[]>(
    hasSavedLayout ? defaultBannerPositions(draggableItems) : draggableItems
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

  // Posisi tersimpan sebelumnya dihitung relatif ke SELURUH layar (dulu
  // area-nya "fixed", nutupin sampai ke sidebar). Sekarang area-nya udah
  // "absolute" relatif ke konten halaman doang (biar ikut ke-scroll), yang
  // lebih sempit & mulai lebih ke kanan. Biar karakter yang udah diatur
  // Owner sebelumnya ga ilang/kepotong ke luar layar, sekali di awal kita
  // "tarik masuk" lagi posisinya biar tetep muat di area yang sekarang.
  useEffect(() => {
    if (!hasSavedLayout) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setLocalItems((prev) =>
      prev.map((it) => {
        if (typeof it.x !== "number" || typeof it.y !== "number") return it;
        const itemWidth = it.heightPx * 1.4;
        const maxX = Math.max(0, rect.width - itemWidth);
        const maxY = Math.max(0, rect.height - it.heightPx);
        return {
          ...it,
          x: Math.min(Math.max(it.x, 0), maxX),
          y: Math.min(Math.max(it.y, 0), maxY),
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enterEditMode() {
    setLocalItems((prev) => {
      if (prev.some((it) => typeof it.x === "number")) return prev;
      // Belum ada posisi tersimpan -- hitung posisi awal berjejer nempel
      // pojok kiri-bawah (samain kayak tampilan default), baru dari situ
      // Owner bisa mulai geser-geser manual.
      const gap = 6;
      let x = 16;
      const rowHeight = Math.max(...prev.map((it) => it.heightPx), 40);
      const viewportHeight =
        typeof window !== "undefined" ? window.innerHeight : 800;
      const y = Math.max(16, viewportHeight - rowHeight - 24);
      return prev.map((it) => {
        const withPos = { ...it, x, y: y + (rowHeight - it.heightPx) };
        x += it.heightPx * 1.4 + gap;
        return withPos;
      });
    });
    setEditMode(true);
  }

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

  function resize(key: string, delta: number) {
    setLocalItems((prev) =>
      prev.map((it) =>
        it.key === key
          ? { ...it, heightPx: Math.max(16, Math.min(160, it.heightPx + delta)) }
          : it
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    // Logo tetap dikirim apa adanya (statis, ga ada x/y) biar posisinya
    // di kiri-bawah ga ikut ke-lock ke database -- yang disimpan cuma
    // posisi karakter yang emang digeser Owner.
    await saveBannerLayout([...localItems, ...logoItems]);
    setSaving(false);
    setEditMode(false);
    router.refresh();
  }

  function handleCancel() {
    setLocalItems(
      hasSavedLayout ? defaultBannerPositions(draggableItems) : draggableItems
    );
    setEditMode(false);
  }

  const logoRow = (
    <div
      className="fixed z-30 flex items-end gap-1.5 pointer-events-none"
      style={{ left: BM_LOGO_LEFT_PX, bottom: BM_LOGO_BOTTOM_PX }}
    >
      {logoItems.map((it) => (
        <Image
          key={it.key}
          src={it.file}
          alt={it.label}
          width={it.heightPx * 1.4}
          height={it.heightPx}
          style={{ height: it.heightPx }}
          className="w-auto object-contain"
          draggable={false}
        />
      ))}
    </div>
  );

  // Tampilan default: karakter belum pernah diatur & lagi ga di mode edit
  // -- baris kecil rapi nempel pojok kiri-bawah layar juga (posisi &
  // ukuran default persis kayak sebelum fitur "geser posisi" dipakai).
  if (!editMode && !hasSavedLayout) {
    return (
      <>
        {canEdit && (
          <div className="fixed top-4 right-6 z-50 flex items-center gap-3 bg-white/95 backdrop-blur border border-bmos-border rounded-xl px-3 py-2 shadow-sm">
            <button
              type="button"
              onClick={enterEditMode}
              className="text-xs font-semibold text-bmos-primary bg-bmos-primary-soft rounded-lg px-3 py-1.5 hover:bg-bmos-primary-light hover:text-white transition cursor-pointer"
            >
              Atur posisi karakter
            </button>
          </div>
        )}
        {logoRow}
        {/* Baris normal (BUKAN fixed/absolute) biar ikut scroll bareng
            konten halaman, ga nempel di layar terus. */}
        <div className="flex items-end justify-end gap-1.5 mb-4">
          {draggableItems.map((it) => (
            <Image
              key={it.key}
              src={it.file}
              alt={it.label}
              width={it.heightPx * 1.4}
              height={it.heightPx}
              style={{ height: it.heightPx }}
              className="w-auto object-contain"
              draggable={false}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {canEdit && (
        <div className="fixed top-4 right-6 z-50 flex items-center gap-3 bg-white/95 backdrop-blur border border-bmos-border rounded-xl px-3 py-2 shadow-sm">
          {!editMode ? (
            <button
              type="button"
              onClick={enterEditMode}
              className="text-xs font-semibold text-bmos-primary bg-bmos-primary-soft rounded-lg px-3 py-1.5 hover:bg-bmos-primary-light hover:text-white transition cursor-pointer"
            >
              Atur posisi karakter
            </button>
          ) : (
            <>
              <span className="text-xs text-bmos-text-light">
                Tarik buat geser, +/- buat ukuran
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
      {logoRow}
      {/* Absolute (BUKAN fixed) relatif ke area konten halaman (wrapper
          "relative" di page.tsx/SimpleHome.tsx) -- biar karakter ikut
          ke-scroll bareng konten, ga nempel terus di layar pas di-scroll.
          Area gesernya nutupin seluruh tinggi konten halaman. */}
      <div
        ref={containerRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`absolute inset-0 z-30 ${
          editMode
            ? "pointer-events-auto border-2 border-dashed border-bmos-primary-light bg-bmos-primary-soft/5"
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
            {editMode && (
              <div className="flex justify-center gap-1 mt-0.5">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => resize(it.key, -6)}
                  className="w-5 h-5 text-xs rounded bg-white border border-bmos-border hover:bg-bmos-primary-soft pointer-events-auto"
                >
                  −
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => resize(it.key, 6)}
                  className="w-5 h-5 text-xs rounded bg-white border border-bmos-border hover:bg-bmos-primary-soft pointer-events-auto"
                >
                  +
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
