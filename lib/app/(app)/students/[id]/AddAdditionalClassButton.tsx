"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addAdditionalClass } from "../actions";

type ClassOption = { id: string; name: string; teacher_name: string | null };

export default function AddAdditionalClassButton({
  studentId,
  classes,
}: {
  studentId: string;
  classes: ClassOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await addAdditionalClass(studentId, classId);

    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setClassId("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-white border border-bmos-border text-bmos-text rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-bmos-primary-soft transition"
      >
        + Tambah Kelas Lain
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-bmos-text mb-1">
              Tambah Kelas Lain
            </h2>
            <p className="text-xs text-bmos-text-light mb-4">
              Murid bisa ikut lebih dari 1 kelas sekaligus -- kelas yang
              sekarang tetap jalan, ini nambah, bukan gantiin.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-bmos-text mb-1">
                  Kelas
                </label>
                <select
                  required
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                >
                  <option value="">Pilih kelas</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.teacher_name})
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm text-bmos-text-light hover:text-bmos-text"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
                >
                  {loading ? "Menambahkan..." : "Tambahkan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
