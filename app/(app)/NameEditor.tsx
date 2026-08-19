"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMyName } from "./account/actions";

export default function NameEditor({ fullName }: { fullName: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fullName || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await updateMyName(value);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="Nama Lengkap"
          className="text-lg font-semibold text-bmos-text border-b-2 border-bmos-primary-light focus:outline-none bg-transparent"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-xs font-semibold text-bmos-primary hover:underline disabled:opacity-50"
        >
          {saving ? "..." : "Simpan"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-xs text-bmos-text-light hover:text-bmos-text"
        >
          Batal
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-lg font-semibold text-bmos-text-light hover:text-bmos-primary transition text-left"
      title="Klik buat isi/ubah nama"
    >
      {fullName || "Nama Lengkap"}
    </button>
  );
}
