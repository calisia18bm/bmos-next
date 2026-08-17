"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { transferClass } from "../actions";

type ClassOption = { id: string; name: string; teacher_name: string | null };
type ActiveEnrollment = {
  id: string;
  class_id: string;
  className: string;
};

export default function TransferClassButton({
  studentId,
  activeEnrollments,
  classes,
}: {
  studentId: string;
  activeEnrollments: ActiveEnrollment[];
  classes: ClassOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fromEnrollmentId, setFromEnrollmentId] = useState(
    activeEnrollments.length === 1 ? activeEnrollments[0].id : ""
  );
  const [newClassId, setNewClassId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fromEnrollment = activeEnrollments.find((e) => e.id === fromEnrollmentId);
  const availableClasses = classes.filter(
    (c) => !activeEnrollments.some((e) => e.class_id === c.id)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await transferClass(studentId, fromEnrollmentId, newClassId, reason);

    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setNewClassId("");
    setReason("");
    setOpen(false);
    router.refresh();
  }

  if (activeEnrollments.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-white border border-bmos-border text-bmos-text rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-bmos-primary-soft transition"
      >
        🔄 Pindah Kelas
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold text-bmos-text mb-1">
              Pindah Kelas
            </h2>
            <p className="text-xs text-bmos-text-light mb-4">
              Kelas asal otomatis dihentikan &amp; kesimpen di riwayat --
              kalau murid ikut kelas lain juga, kelas itu TETAP jalan.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {activeEnrollments.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-bmos-text mb-1">
                    Dari Kelas
                  </label>
                  <select
                    required
                    value={fromEnrollmentId}
                    onChange={(e) => setFromEnrollmentId(e.target.value)}
                    className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                  >
                    <option value="">Pilih kelas yang mau diganti</option>
                    {activeEnrollments.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.className}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeEnrollments.length === 1 && (
                <div className="text-sm bg-bmos-primary-soft/40 rounded-xl px-3 py-2.5">
                  Dari: <strong>{fromEnrollment?.className}</strong>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-bmos-text mb-1">
                  Ke Kelas Baru
                </label>
                <select
                  required
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                  className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                >
                  <option value="">Pilih kelas tujuan</option>
                  {availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.teacher_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-bmos-text mb-1">
                  Alasan (opsional)
                </label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Minta pindah jadwal, dll"
                  className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                />
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
                  disabled={loading || !fromEnrollmentId}
                  className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
                >
                  {loading ? "Memindahkan..." : "Pindahkan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
