"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Ganti password punya sendiri -- bisa dipakai SEMUA role (murid, laoshi,
// admin, owner), soalnya ini cuma ganti akun sendiri. Wajib masukin
// password LAMA dulu buat verifikasi (di-cek dengan coba login ulang),
// baru boleh set password baru -- biar ga sembarang orang yang kebetulan
// lagi pegang HP/laptop yang masih login bisa asal ganti password orang.
// Kalau Owner/Admin mau ganti password ORANG LAIN yang lupa passwordnya,
// itu lewat halaman Accounts (Reset Password), bukan tombol ini.
export default function ChangePasswordButton({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function closeAndReset() {
    setOpen(false);
    setOldPassword("");
    setPassword("");
    setConfirm("");
    setError("");
    setDone(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!oldPassword) {
      setError("Password lama wajib diisi.");
      return;
    }
    if (password.length < 6) {
      setError("Password baru minimal 6 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password baru tidak sama.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Verifikasi password lama dulu -- coba login ulang pakai email +
    // password lama. Kalau salah, signIn-nya bakal error.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: oldPassword,
    });

    if (signInError) {
      setLoading(false);
      setError("Password lama salah.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-sm text-bmos-text-light hover:text-bmos-text text-left px-2 py-2"
      >
        Ganti Password
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            {done ? (
              <>
                <h2 className="text-lg font-bold text-bmos-text mb-2">
                  Password berhasil diganti
                </h2>
                <p className="text-sm text-bmos-text-light mb-4">
                  Pakai password baru ini lain kali login.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeAndReset}
                    className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition"
                  >
                    Selesai
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-bmos-text mb-4">
                  Ganti Password
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Password Lama
                    </label>
                    <input
                      type="password"
                      required
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Password Baru
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Ulangi Password Baru
                    </label>
                    <input
                      type="password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
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
                      onClick={closeAndReset}
                      className="px-4 py-2 text-sm text-bmos-text-light hover:text-bmos-text"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
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
