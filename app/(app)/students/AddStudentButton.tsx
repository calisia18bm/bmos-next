"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addStudent, findRejoinCandidates, reactivateStudent } from "./actions";

type Candidate = {
  id: string;
  student_code: string;
  name: string;
  phone: string | null;
  class_name: string | null;
  teacher_name: string | null;
  status: string;
  created_at: string;
};

export default function AddStudentButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);

  function reset() {
    setName("");
    setPhone("");
    setError("");
    setCandidates(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Cek dulu apakah nama/no. HP ini cocok sama murid lama yang statusnya
    // INACTIVE (kemungkinan dia pernah berhenti dan sekarang daftar lagi).
    const matches = await findRejoinCandidates(name, phone);
    setLoading(false);

    if (matches.length > 0) {
      setCandidates(matches);
      return;
    }

    await submitAsNew();
  }

  async function submitAsNew() {
    setLoading(true);
    setError("");

    const result = await addStudent({ name, phone });

    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    reset();
    setOpen(false);
    router.refresh();
  }

  async function handleReactivate(candidateId: string) {
    setLoading(true);
    setError("");

    const result = await reactivateStudent(candidateId, { name, phone });

    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-bmos-primary text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition"
      >
        + Tambah Murid
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            {candidates ? (
              <>
                <h2 className="text-lg font-bold text-bmos-text mb-1">
                  Murid ini kemungkinan pernah terdaftar
                </h2>
                <p className="text-sm text-bmos-text-light mb-4">
                  Ditemukan {candidates.length} murid lama dengan nama/no. HP
                  yang mirip dan statusnya sudah non-aktif. Kalau ini orang
                  yang sama, aktifkan lagi data lamanya supaya riwayat
                  absensi &amp; pembayaran sebelumnya tidak hilang.
                </p>

                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {candidates.map((c) => (
                    <div
                      key={c.id}
                      className="border border-bmos-border rounded-xl p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-bmos-text truncate">
                          {c.name}{" "}
                          <span className="text-xs text-bmos-text-light font-normal">
                            ({c.student_code})
                          </span>
                        </p>
                        <p className="text-xs text-bmos-text-light truncate">
                          {c.phone || "-"} · {c.class_name || "Belum ada kelas"}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleReactivate(c.id)}
                        className="shrink-0 bg-bmos-primary text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
                      >
                        Aktifkan Lagi
                      </button>
                    </div>
                  ))}
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
                    {error}
                  </p>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-bmos-border">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      reset();
                    }}
                    className="px-4 py-2 text-sm text-bmos-text-light hover:text-bmos-text"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={submitAsNew}
                    className="px-4 py-2 text-sm font-semibold text-bmos-text-light hover:text-bmos-text disabled:opacity-60"
                  >
                    {loading ? "Menyimpan..." : "Bukan, tetap buat murid baru"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-bmos-text mb-4">
                  Tambah Murid
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Nama Lengkap Murid
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

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        reset();
                      }}
                      className="px-4 py-2 text-sm text-bmos-text-light hover:text-bmos-text"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
                    >
                      {loading ? "Mengecek..." : "Simpan"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
