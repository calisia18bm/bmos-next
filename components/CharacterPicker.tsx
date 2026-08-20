"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CHARACTERS, getCharacterFile } from "@/lib/characters";
import { updateGlobalCharacter } from "@/app/(app)/settings/branding/actions";

// Avatar di sidebar ini SATU karakter yang sama buat semua akun (murid,
// laoshi, admin, owner semua liat karakter yang sama). Cuma Owner yang
// bisa buka picker & ganti -- lihat canEdit di Sidebar.tsx.
export default function CharacterPicker({
  characterKey,
  canEdit = false,
}: {
  characterKey: string | null;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const currentFile = getCharacterFile(characterKey);

  async function handlePick(key: string) {
    setLoading(true);
    setError("");
    const res = await updateGlobalCharacter(key);
    setLoading(false);

    if (!res.success) {
      // Dulu error di sini ke-telen diem-diem (popup nutup kayak
      // berhasil padahal gagal) -- sekarang ditampilin biar ketauan
      // penyebabnya, misal kolom global_character_key di Supabase belum
      // dibuat (lupa jalanin database/add_global_character.sql).
      setError(res.message);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  // Yang bukan Owner cuma liat avatarnya, ga bisa buka picker buat ganti.
  if (!canEdit) {
    return (
      <div
        title="Karakter BMOS"
        className="w-10 h-10 rounded-xl bg-bmos-primary-soft flex items-center justify-center overflow-hidden shrink-0"
      >
        <Image
          src={currentFile}
          alt="Karakter BMOS"
          width={26}
          height={26}
          className="object-contain"
        />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ganti karakter (berlaku untuk semua akun)"
        className="w-10 h-10 rounded-xl bg-bmos-primary-soft flex items-center justify-center overflow-hidden shrink-0 hover:opacity-80 transition"
      >
        <Image
          src={currentFile}
          alt="Karakter BMOS"
          width={26}
          height={26}
          className="object-contain"
        />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-bmos-text mb-1">
              Pilih Karakter
            </h2>
            <p className="text-xs text-bmos-text-light mb-4">
              Karakter ini muncul sebagai avatar di sidebar untuk SEMUA akun
              (murid, laoshi, admin, owner) -- bukan cuma punyamu sendiri.
            </p>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">
                Gagal ganti karakter: {error}
              </p>
            )}
            <div className="grid grid-cols-4 gap-3">
              {CHARACTERS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  disabled={loading}
                  onClick={() => handlePick(c.key)}
                  title={c.label}
                  className={`w-16 h-16 rounded-xl border-2 flex items-center justify-center p-3 overflow-hidden transition disabled:opacity-50 ${
                    c.key === characterKey
                      ? "border-bmos-primary bg-bmos-primary-soft"
                      : "border-bmos-border hover:border-bmos-primary-light"
                  }`}
                >
                  <Image
                    src={c.file}
                    alt={c.label}
                    width={32}
                    height={32}
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-bmos-text-light hover:text-bmos-text"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
