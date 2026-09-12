"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTeacher } from "./actions";

type TeacherData = {
  id: string;
  name: string;
  phone: string | null;
  rate_type: string | null;
  rate_per_session: number | null;
  rate_per_package: number | null;
  sessions_per_payout: number | null;
  active: boolean;
};

export default function EditTeacherButton({ teacher }: { teacher: TeacherData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(teacher.name);
  const [phone, setPhone] = useState(teacher.phone || "");
  const [rateType, setRateType] = useState<"SESSION" | "PACKAGE">(
    teacher.rate_type === "PACKAGE" ? "PACKAGE" : "SESSION"
  );
  const [rate, setRate] = useState(String(teacher.rate_per_session || 0));
  const [ratePerPackage, setRatePerPackage] = useState(String(teacher.rate_per_package || 0));
  const [payout, setPayout] = useState(String(teacher.sessions_per_payout || 8));
  const [active, setActive] = useState(teacher.active);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await updateTeacher(teacher.id, {
      name,
      phone,
      rateType,
      ratePerSession: rate,
      ratePerPackage,
      sessionsPerPayout: payout,
      active,
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
        className="text-xs font-semibold text-bmos-primary hover:underline"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-bmos-text mb-4">
              Edit Laoshi
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
                <label className="block text-sm font-medium text-bmos-text mb-2">
                  Cara Hitung Rate
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center gap-2 border rounded-xl px-3 py-2 text-sm cursor-pointer transition ${
                      rateType === "SESSION"
                        ? "border-bmos-primary bg-bmos-primary-soft"
                        : "border-bmos-border hover:border-bmos-primary-light"
                    }`}
                  >
                    <input
                      type="radio"
                      name="rateTypeEdit"
                      checked={rateType === "SESSION"}
                      onChange={() => setRateType("SESSION")}
                      className="accent-bmos-primary"
                    />
                    Per Sesi
                  </label>
                  <label
                    className={`flex items-center gap-2 border rounded-xl px-3 py-2 text-sm cursor-pointer transition ${
                      rateType === "PACKAGE"
                        ? "border-bmos-primary bg-bmos-primary-soft"
                        : "border-bmos-border hover:border-bmos-primary-light"
                    }`}
                  >
                    <input
                      type="radio"
                      name="rateTypeEdit"
                      checked={rateType === "PACKAGE"}
                      onChange={() => setRateType("PACKAGE")}
                      className="accent-bmos-primary"
                    />
                    Per Paket
                  </label>
                </div>
              </div>

              {rateType === "SESSION" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Rate / Sesi (Rp)
                    </label>
                    <input
                      type="number"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Sesi / Pembayaran
                    </label>
                    <input
                      type="number"
                      value={payout}
                      onChange={(e) => setPayout(e.target.value)}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Sesi per Paket
                    </label>
                    <input
                      type="number"
                      value={payout}
                      onChange={(e) => setPayout(e.target.value)}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Rate per Paket (Rp)
                    </label>
                    <input
                      type="number"
                      value={ratePerPackage}
                      onChange={(e) => setRatePerPackage(e.target.value)}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    />
                  </div>
                </div>
              )}
              {rateType === "PACKAGE" && (
                <p className="text-[11px] text-bmos-text-light -mt-2">
                  Payroll dihitung: tiap kelipatan {payout || "?"} sesi yang udah
                  diajar dalam periode = 1 paket, dibayar flat segitu. Sisa
                  sesi yang belum genap 1 paket otomatis ikut dihitung di
                  payroll periode berikutnya.
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-bmos-text mb-1">
                  Status
                </label>
                <select
                  value={active ? "Y" : "N"}
                  onChange={(e) => setActive(e.target.value === "Y")}
                  className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                >
                  <option value="Y">Aktif</option>
                  <option value="N">Non-Aktif</option>
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
                  {loading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
