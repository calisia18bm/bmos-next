"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CHARACTERS, getCharacterFile } from "@/lib/characters";
// Avatar di sidebar itu SATU karakter GLOBAL buat semua akun (bukan
// punya masing-masing user), jadi yang dipanggil pas Owner ganti karakter
// harus updateGlobalCharacter -- BUKAN updateMyCharacter (itu cuma
// nyimpen ke profil user yang lagi login sendiri, ga kepake buat avatar
// yang ditampilin di Sidebar/Login).
import { updateGlobalCharacter } from "@/app/(app)/settings/branding/actions";

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
  const currentFile = getCharacterFile(characterKey);

  async function handlePick(key: string) {
    setLoading(true);
    await updateGlobalCharacter(key);
    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  // Yang bukan Owner cuma liat avatarnya, ga bisa buka picker buat ganti.
  if (!canEdit) {
    return (
      <div
        title="Karaktermu"
        className="w-10 h-10 rounded-xl bg-bmos-primary-soft flex items-center justify-center overflow-hidden shrink-0"
      >
        <Image src={currentFile} alt="Karaktermu" width={28} height={28} className="object-contain" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ganti karakter"
        className="w-10 h-10 rounded-xl bg-bmos-primary-soft flex items-center justify-center overflow-hidden shrink-0 hover:opacity-80 transition"
      >
        <Image src={currentFile} alt="Karaktermu" width={28} height={28} className="object-contain" />
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-bmos-text mb-1">
              Pilih Karaktermu
            </h2>
            <p className="text-xs text-bmos-text-light mb-4">
              Karakter ini muncul sebagai avatarmu di sidebar & dashboard.
            </p>
            <div className="grid grid-cols-4 gap-3">
              {CHARACTERS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  disabled={loading}
                  onClick={() => handlePick(c.key)}
                  title={c.label}
                  className={`w-16 h-16 mx-auto rounded-xl border-2 flex items-center justify-center p-2 overflow-hidden transition disabled:opacity-50 ${
                    c.key === characterKey
                      ? "border-bmos-primary bg-bmos-primary-soft"
                      : "border-bmos-border hover:border-bmos-primary-light"
                  }`}
                >
                  <Image
                    src={c.file}
                    alt={c.label}
                    width={40}
                    height={40}
                    className="object-contain max-w-full max-h-full"
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
