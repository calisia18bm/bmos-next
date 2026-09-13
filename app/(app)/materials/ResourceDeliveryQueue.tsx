"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendResourceToClasses, ResourceDelivery } from "./actions";

// Widget buat Owner/Admin di halaman Materi -- daftar bahan ajar yang
// udah dibeli (APPROVED) sama Laoshi, lengkap sama daftar kelas Laoshi
// itu. Admin pilih kelas mana aja (bisa lebih dari 1, Laoshi yang sama
// bisa dipake di beberapa kelas) terus klik "Kirim ke Murid" -- materi
// otomatis nongol di halaman Materi murid-murid kelas itu. Kelas yang
// udah pernah dikirimin ditandai centang hijau & ga bisa dipilih lagi
// (biar ga dobel-kirim ga sadar).
export default function ResourceDeliveryQueue({
  deliveries,
}: {
  deliveries: ResourceDelivery[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; ok: boolean } | null>(
    null
  );

  function toggleOpen(d: ResourceDelivery) {
    if (openId === d.purchaseId) {
      setOpenId(null);
      return;
    }
    setOpenId(d.purchaseId);
    setSelected({});
  }

  function toggleClass(classId: string) {
    setSelected((prev) => ({ ...prev, [classId]: !prev[classId] }));
  }

  async function handleSend(d: ResourceDelivery) {
    const classIds = Object.keys(selected).filter((id) => selected[id]);
    if (classIds.length === 0) return;

    setBusyId(d.purchaseId);
    const result = await sendResourceToClasses(d.purchaseId, classIds);
    setBusyId(null);
    setMessage({ id: d.purchaseId, text: result.message, ok: result.success });
    if (result.success) {
      setSelected({});
      setOpenId(null);
      router.refresh();
    }
  }

  if (deliveries.length === 0) return null;

  return (
    <div className="bg-white border border-bmos-border rounded-2xl p-6">
      <h2 className="text-lg font-bold text-bmos-text mb-1">
        📤 Kirim Bahan Ajar ke Murid
      </h2>
      <p className="text-bmos-text-light text-sm mb-4">
        Bahan ajar yang udah dibeli Laoshi bisa kamu kirim ke murid-murid
        di kelas manapun yang Laoshi itu ajar -- ga perlu nunggu kelas
        selesai, bisa kapan aja, dan bisa ke beberapa kelas sekaligus.
      </p>
      <div className="space-y-3">
        {deliveries.map((d) => (
          <div
            key={d.purchaseId}
            className="border border-bmos-border rounded-2xl p-4"
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="font-bold text-bmos-text">{d.resourceTitle}</p>
                <p className="text-xs text-bmos-text-light">
                  👤 {d.teacherName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleOpen(d)}
                className="text-xs font-semibold text-white bg-bmos-primary rounded-lg px-3 py-1.5 hover:bg-bmos-primary-light transition"
              >
                {openId === d.purchaseId ? "Tutup" : "Kirim ke Murid"}
              </button>
            </div>

            {message?.id === d.purchaseId && (
              <p
                className={`text-xs rounded-lg px-2.5 py-1.5 mt-2 ${
                  message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                }`}
              >
                {message.text}
              </p>
            )}

            {openId === d.purchaseId && (
              <div className="mt-3 border-t border-bmos-border pt-3">
                {d.classes.length === 0 ? (
                  <p className="text-xs text-bmos-text-light">
                    Laoshi ini belum megang kelas apapun.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {d.classes.map((c) => (
                      <label
                        key={c.classId}
                        className={`flex items-center gap-2 text-sm rounded-lg px-2.5 py-1.5 ${
                          c.alreadySent
                            ? "text-bmos-text-light bg-green-50/60"
                            : "text-bmos-text hover:bg-bmos-primary-soft/40 cursor-pointer"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={c.alreadySent}
                          checked={c.alreadySent || !!selected[c.classId]}
                          onChange={() => toggleClass(c.classId)}
                          className="rounded"
                        />
                        {c.className}
                        {c.alreadySent && (
                          <span className="text-xs text-green-700">
                            ✓ Udah dikirim
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={() => handleSend(d)}
                    disabled={
                      busyId === d.purchaseId ||
                      Object.values(selected).every((v) => !v)
                    }
                    className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-50"
                  >
                    {busyId === d.purchaseId ? "Mengirim..." : "Kirim ke Kelas Terpilih"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
