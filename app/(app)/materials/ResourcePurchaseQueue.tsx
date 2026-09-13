"use client";

import { useState } from "react";
import {
  approveResourcePurchase,
  rejectResourcePurchase,
  PendingResourcePurchase,
} from "./actions";

function formatRupiah(n: number | null | undefined): string {
  if (!n) return "-";
  return `Rp ${n.toLocaleString("id-ID")}`;
}

// Widget buat Owner/Admin di halaman Materi -- daftar request beli bahan
// ajar berbayar (dari Laoshi) yang lagi PENDING, lengkap sama bukti
// transfer & catatan AI (yang CUMA bantu baca, bukan yang mutusin).
// Approve/Reject-nya tetap manual diklik Admin/Owner sendiri. Sengaja
// dibikin beda visual (amber, bukan biru/ungu kayak JoinRequestsQueue di
// Class Card) biar keliatan ini fitur beli materi, bukan join kelas.
export default function ResourcePurchaseQueue({
  requests,
}: {
  requests: PendingResourcePurchase[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [message, setMessage] = useState<{ id: string; text: string; ok: boolean } | null>(
    null
  );

  async function handleApprove(id: string) {
    setBusyId(id);
    const result = await approveResourcePurchase(id);
    setBusyId(null);
    setMessage({ id, text: result.message, ok: result.success });
  }

  async function handleReject(id: string) {
    if (!rejectNote.trim()) return;
    setBusyId(id);
    const result = await rejectResourcePurchase(id, rejectNote);
    setBusyId(null);
    setMessage({ id, text: result.message, ok: result.success });
    if (result.success) {
      setRejectingId(null);
      setRejectNote("");
    }
  }

  if (requests.length === 0) return null;

  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-6">
      <h2 className="text-lg font-bold text-bmos-text mb-1">
        💰 Request Beli Bahan Ajar{" "}
        <span className="text-sm font-semibold text-white bg-amber-600 rounded-full px-2 py-0.5 align-middle">
          {requests.length}
        </span>
      </h2>
      <p className="text-bmos-text-light text-sm mb-4">
        Laoshi upload bukti transfer sebelum bisa download bahan ajar
        berbayar -- cek bukti bayarnya (ada bantuan baca dari AI, tapi
        keputusan approve/reject tetap kamu yang pegang) sebelum klik
        Setujui.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {requests.map((r) => (
          <div
            key={r.purchaseId}
            className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 flex flex-col gap-2"
          >
            <p className="font-bold text-bmos-text">{r.resourceTitle}</p>
            <p className="text-xs text-bmos-text-light">👤 {r.teacherName}</p>
            {!!r.price && <p className="text-xs text-bmos-text-light">{formatRupiah(r.price)}</p>}

            {r.paymentProofUrl && (
              <a href={r.paymentProofUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={r.paymentProofUrl}
                  alt="Bukti transfer"
                  className="w-full h-32 object-cover rounded-xl border border-amber-200"
                />
              </a>
            )}

            {r.aiPaymentNote && (
              <p className="text-xs bg-amber-100 text-bmos-text rounded-lg px-2.5 py-1.5">
                🤖 {r.aiPaymentNote}
              </p>
            )}

            {message?.id === r.purchaseId && (
              <p
                className={`text-xs rounded-lg px-2.5 py-1.5 ${
                  message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                }`}
              >
                {message.text}
              </p>
            )}

            {rejectingId === r.purchaseId ? (
              <div className="flex flex-col gap-1.5">
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Alasan penolakan buat Laoshi..."
                  rows={2}
                  className="w-full border border-bmos-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(r.purchaseId)}
                    disabled={busyId === r.purchaseId || !rejectNote.trim()}
                    className="flex-1 bg-red-600 text-white rounded-xl py-2 text-xs font-semibold hover:bg-red-700 transition disabled:opacity-50"
                  >
                    Kirim Penolakan
                  </button>
                  <button
                    onClick={() => {
                      setRejectingId(null);
                      setRejectNote("");
                    }}
                    className="px-3 rounded-xl border border-bmos-border text-xs font-semibold text-bmos-text-light"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => handleApprove(r.purchaseId)}
                  disabled={busyId === r.purchaseId}
                  className="flex-1 bg-amber-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-amber-700 transition disabled:opacity-50"
                >
                  {busyId === r.purchaseId ? "Memproses..." : "Setujui"}
                </button>
                <button
                  onClick={() => setRejectingId(r.purchaseId)}
                  disabled={busyId === r.purchaseId}
                  className="flex-1 border border-red-200 text-red-600 rounded-xl py-2 text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50"
                >
                  Tolak
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
