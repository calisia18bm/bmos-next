"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateStudent } from "../actions";

type ClassOption = { id: string; name: string; teacher_name: string | null };

type StudentData = {
  id: string;
  name: string;
  phone: string | null;
  class_id: string | null;
  sessions_per_package: number | null;
  package_price: number | null;
  status: string;
  notes: string | null;
};

export default function EditStudentButton({
  student,
  classes,
}: {
  student: StudentData;
  classes: ClassOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(student.name);
  const [phone, setPhone] = useState(student.phone || "");
  const [classId, setClassId] = useState(student.class_id || "");
  const [sessions, setSessions] = useState(String(student.sessions_per_package || 4));
  const [price, setPrice] = useState(String(student.package_price || 0));
  const [status, setStatus] = useState(student.status);
  const [notes, setNotes] = useState(student.notes || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const selectedClass = classes.find((c) => c.id === classId);

    const result = await updateStudent(student.id, {
      name,
      phone,
      classId,
      className: selectedClass?.name || "",
      teacherName: selectedClass?.teacher_name || "",
      sessionsPerPackage: sessions,
      packagePrice: price,
      status,
      notes,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-white border border-bmos-border text-bmos-text rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-bmos-primary-soft transition"
      >
        ✏️ Edit
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-bmos-text mb-4">
              Edit Data Murid
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-bmos-text mb-1">
                  Nama Murid
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-bmos-text mb-1">
                  No. HP
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-bmos-text mb-1">
                  Kelas
                </label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                >
                  <option value="">Belum ada kelas</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.teacher_name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-bmos-text mb-1">
                    Sesi per Paket
                  </label>
                  <input
                    type="number"
                    value={sessions}
                    onChange={(e) => setSessions(e.target.value)}
                    className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-bmos-text mb-1">
                    Harga Paket (Rp)
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-bmos-text mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Non-Aktif</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-bmos-text mb-1">
                  Catatan
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
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
                  disabled={loading}
                  className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
                >
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
