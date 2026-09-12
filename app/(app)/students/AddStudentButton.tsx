"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addStudent,
  findRejoinCandidates,
  reactivateStudent,
  getAvailableStudentCodes,
} from "./actions";

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

type ClassOption = { id: string; name: string; teacher_name: string | null };

export default function AddStudentButton({
  classes,
}: {
  classes: ClassOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);

  const [codeOptions, setCodeOptions] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [codesLoading, setCodesLoading] = useState(false);

  // Opsional: sekalian bikinin akun login pas nambah murid, biar ga usah
  // ke halaman Accounts terpisah lagi. Cuma bisa jalan kalau yang lagi
  // login itu Owner -- dicek ulang di server.
  const [createAccount, setCreateAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");

  // Hasil akun yang baru dibuat (email + password), ditampilin sekali abis
  // simpan -- sama kayak alur di halaman Accounts.
  const [accountResult, setAccountResult] = useState<{
    email: string;
    password: string;
  } | null>(null);
  // Kalau murid berhasil disimpan tapi akunnya GAGAL dibuat (misal yang
  // nambah bukan Owner), kasih tau di sini -- muridnya tetap kesimpen.
  const [accountWarning, setAccountWarning] = useState("");

  // Ambil daftar kode murid yang masih kosong (termasuk "lubang" dari kode
  // lama) tiap kali modal dibuka, biar dropdown-nya selalu up to date --
  // jangan sampai nawarin kode yang baru aja kepake orang lain.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCodesLoading(true);
    getAvailableStudentCodes().then((codes) => {
      if (cancelled) return;
      setCodesLoading(false);
      setCodeOptions(codes);
      setCode((prev) => (prev && codes.includes(prev) ? prev : codes[0] || ""));
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function reset() {
    setName("");
    setPhone("");
    setClassId("");
    setStatus("ACTIVE");
    setCode("");
    setCreateAccount(false);
    setEmail("");
    setAccountPassword("");
    setError("");
    setCandidates(null);
    setAccountResult(null);
    setAccountWarning("");
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

    const result = await addStudent({
      name,
      phone,
      classId,
      status,
      code,
      createAccount,
      email: createAccount ? email : undefined,
      password: createAccount ? accountPassword : undefined,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.message);
      // Kalau gagalnya gara-gara kode kepake duluan, refresh daftar
      // kodenya biar dropdown ga nawarin kode yang sama lagi.
      getAvailableStudentCodes().then((codes) => {
        setCodeOptions(codes);
        setCode(codes[0] || "");
      });
      return;
    }

    // Murid berhasil ditambahkan. Kalau sekalian minta bikin akun:
    if (result.account) {
      // Akun berhasil kebuat -- tampilin dulu email/password-nya sebelum
      // modal ditutup.
      setAccountResult(result.account);
      router.refresh();
      return;
    }

    if (result.accountWarning) {
      // Murid tetap kesimpen, tapi akunnya ga jadi dibuat -- kasih tau.
      setAccountWarning(result.accountWarning);
      router.refresh();
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            {accountResult ? (
              <>
                <h2 className="text-lg font-bold text-bmos-text mb-1">
                  Murid & akun berhasil dibuat
                </h2>
                <p className="text-sm text-bmos-text-light mb-4">
                  Kirim info login ini ke muridnya (lewat WhatsApp misalnya).
                  Password ini cuma muncul sekali di sini, catat sekarang
                  sebelum ditutup.
                </p>
                <div className="bg-bmos-primary-soft/40 rounded-xl p-4 space-y-2 mb-4">
                  <p className="text-sm">
                    <span className="text-bmos-text-light">Email: </span>
                    <span className="font-semibold text-bmos-text">
                      {accountResult.email}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-bmos-text-light">Password: </span>
                    <span className="font-semibold text-bmos-text font-mono">
                      {accountResult.password}
                    </span>
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      reset();
                    }}
                    className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition"
                  >
                    Selesai
                  </button>
                </div>
              </>
            ) : accountWarning ? (
              <>
                <h2 className="text-lg font-bold text-bmos-text mb-1">
                  Murid berhasil ditambahkan
                </h2>
                <p className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
                  Tapi akun login belum dibuat: {accountWarning}
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      reset();
                    }}
                    className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition"
                  >
                    Tutup
                  </button>
                </div>
              </>
            ) : candidates ? (
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
                      Kode Murid
                    </label>
                    <select
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      disabled={codesLoading || codeOptions.length === 0}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bmos-primary-light disabled:opacity-50"
                    >
                      {codesLoading && <option>Memuat...</option>}
                      {!codesLoading && codeOptions.length === 0 && (
                        <option>Gagal ambil daftar kode</option>
                      )}
                      {codeOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-bmos-text-light mt-1">
                      Kode paling atas itu kode lanjutan yang disaranin --
                      tapi boleh dipilih kode lain kalau ada yang kosong
                      (misal bekas murid lama yang udah dihapus).
                    </p>
                  </div>

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

                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Kelas{" "}
                      <span className="text-bmos-text-light font-normal">
                        (boleh dikosongin dulu)
                      </span>
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

                  <div className="border-t border-bmos-border pt-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-bmos-text cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createAccount}
                        onChange={(e) => setCreateAccount(e.target.checked)}
                        className="accent-bmos-primary"
                      />
                      Buatkan akun login sekaligus?
                    </label>
                    <p className="text-[11px] text-bmos-text-light mt-1">
                      Biar muridnya langsung bisa login ke portal, ga usah
                      dibuatin belakangan lewat halaman Accounts. (Cuma bisa
                      kalau yang lagi kelola ini Owner.)
                    </p>

                    {createAccount && (
                      <div className="space-y-3 mt-3">
                        <div>
                          <label className="block text-sm font-medium text-bmos-text mb-1">
                            Email
                          </label>
                          <input
                            required={createAccount}
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-bmos-text mb-1">
                            Password{" "}
                            <span className="text-bmos-text-light font-normal">
                              (opsional -- kosongin aja kalau mau di-generate
                              otomatis)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={accountPassword}
                            onChange={(e) => setAccountPassword(e.target.value)}
                            placeholder="Minimal 6 karakter"
                            className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                          />
                        </div>
                      </div>
                    )}
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
                      disabled={loading || codesLoading || !code}
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
