"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAccount } from "./actions";

const ROLE_OPTIONS = [
  { key: "OWNER", label: "Owner" },
  { key: "ADMIN", label: "Admin" },
  { key: "TEACHER", label: "Laoshi (Teacher)" },
  { key: "STUDENT", label: "Murid (Student)" },
];

export default function AddAccountButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ email: string; password: string } | null>(
    null
  );

  function toggleRole(key: string) {
    setRoles((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]
    );
  }

  function reset() {
    setName("");
    setEmail("");
    setRoles([]);
    setError("");
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await createAccount({ name, email, roles });
    setLoading(false);

    if (!res.success) {
      setError(res.message);
      return;
    }

    setResult({ email: res.email!, password: res.password! });
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-bmos-primary text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition"
      >
        + Buat Akun
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            {result ? (
              <>
                <h2 className="text-lg font-bold text-bmos-text mb-1">
                  Akun berhasil dibuat
                </h2>
                <p className="text-sm text-bmos-text-light mb-4">
                  Kirim info login ini ke orangnya (lewat WhatsApp misalnya).
                  Password ini cuma muncul sekali di sini, catat sekarang
                  sebelum ditutup.
                </p>
                <div className="bg-bmos-primary-soft/40 rounded-xl p-4 space-y-2 mb-4">
                  <p className="text-sm">
                    <span className="text-bmos-text-light">Email: </span>
                    <span className="font-semibold text-bmos-text">
                      {result.email}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-bmos-text-light">Password: </span>
                    <span className="font-semibold text-bmos-text font-mono">
                      {result.password}
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
            ) : (
              <>
                <h2 className="text-lg font-bold text-bmos-text mb-4">
                  Buat Akun Baru
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Nama Lengkap
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
                      Email
                    </label>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-2">
                      Role (boleh pilih lebih dari satu)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {ROLE_OPTIONS.map((r) => (
                        <label
                          key={r.key}
                          className={`flex items-center gap-2 border rounded-xl px-3 py-2 text-sm cursor-pointer transition ${
                            roles.includes(r.key)
                              ? "border-bmos-primary bg-bmos-primary-soft"
                              : "border-bmos-border hover:border-bmos-primary-light"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={roles.includes(r.key)}
                            onChange={() => toggleRole(r.key)}
                            className="accent-bmos-primary"
                          />
                          {r.label}
                        </label>
                      ))}
                    </div>
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
                      {loading ? "Membuat..." : "Buat Akun"}
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
