"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addTeacher } from "./actions";

export default function AddTeacherButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [rate, setRate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Opsional: sekalian bikinin akun login pas nambah laoshi, biar ga usah
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
  // Kalau laoshi berhasil disimpan tapi akunnya GAGAL dibuat (misal yang
  // nambah bukan Owner), kasih tau di sini -- data laoshinya tetap kesimpen.
  const [accountWarning, setAccountWarning] = useState("");

  // Password minimal 6 karakter (aturan Supabase Auth) -- dicek di sini
  // juga (bukan cuma di server) biar tombol Simpan langsung ke-disable dan
  // ga bisa diklik kalau passwordnya kependekan, daripada baru ketahuan
  // gagal setelah laoshi ke-submit (akunnya jadi ga kebuat diem-diem).
  const passwordTooShort =
    createAccount && accountPassword.trim().length > 0 && accountPassword.trim().length < 6;

  function reset() {
    setName("");
    setPhone("");
    setRate("");
    setCreateAccount(false);
    setEmail("");
    setAccountPassword("");
    setError("");
    setAccountResult(null);
    setAccountWarning("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await addTeacher({
      name,
      phone,
      ratePerSession: rate,
      createAccount,
      email: createAccount ? email : undefined,
      password: createAccount ? accountPassword : undefined,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    if (result.account) {
      setAccountResult(result.account);
      router.refresh();
      return;
    }

    if (result.accountWarning) {
      setAccountWarning(result.accountWarning);
      router.refresh();
      return;
    }

    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-bmos-primary text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition"
      >
        + Tambah Laoshi
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            {accountResult ? (
              <>
                <h2 className="text-lg font-bold text-bmos-text mb-1">
                  Laoshi & akun berhasil dibuat
                </h2>
                <p className="text-sm text-bmos-text-light mb-4">
                  Kirim info login ini ke laoshinya (lewat WhatsApp misalnya).
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
                  Laoshi berhasil ditambahkan
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
            ) : (
              <>
                <h2 className="text-lg font-bold text-bmos-text mb-4">
                  Tambah Laoshi
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Nama Laoshi
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
                      Rate per Sesi (Rp)
                    </label>
                    <input
                      type="number"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                      placeholder="75000"
                    />
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
                      Biar laoshinya langsung bisa login ke portal, ga usah
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
                          {passwordTooShort && (
                            <p className="text-xs text-red-600 mt-1">
                              Password minimal 6 karakter.
                            </p>
                          )}
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
                      disabled={loading || (createAccount && (!email || passwordTooShort))}
                      className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
                    >
                      {loading ? "Menyimpan..." : "Simpan"}
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
