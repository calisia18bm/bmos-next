"use client";

import { useState } from "react";
import { approveJoinRequest, rejectJoinRequest, PendingJoinRequest } from "./actions";
import { formatRupiah } from "@/lib/classCards";

// Widget buat BM di halaman Class Card -- daftar request join
// (dari Murid) yang lagi PENDING, lengkap sama bukti transfer & catatan
// AI (yang CUMA bantu baca, bukan yang mutusin). Approve/Reject-nya tetap
// manual diklik BM sendiri.
export default function JoinRequestsQueue({
  requests,
}: {
  requests: PendingJoinRequest[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [message, setMessage] = useState<{ id: string; text: string; ok: boolean } | null>(
    null
  );

  async function handleApprove(id: string) {
    setBusyId(id);
    const result = await approveJoinRequest(id);
    setBusyId(null);
    setMessage({ id, text: result.message, ok: result.success });
  }

  async function handleReject(id: string) {
    if (!rejectNote.trim()) return;
    setBusyId(id);
    const result = await rejectJoinRequest(id, rejectNote);
    setBusyId(null);
    setMessage({ id, text: result.message, ok: result.success });
    if (result.success) {
      setRejectingId(null);
      setRejectNote("");
    }
  }

  if (requests.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-bmos-text mb-1">
        📥 Request Join Murid{" "}
        <span className="text-sm font-semibold text-white bg-bmos-primary rounded-full px-2 py-0.5 align-middle">
          {requests.length}
        </span>
      </h2>
      <p className="text-bmos-text-light text-sm mb-4">
        Murid upload bukti transfer sebelum join -- cek bukti bayarnya
        (ada bantuan baca dari AI, tapi keputusan approve/reject tetap
        kamu yang pegang) sebelum klik Setujui.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {requests.map((r) => (
          <div
            key={r.enrollmentId}
            className="bg-white border border-bmos-border rounded-2xl p-4 flex flex-col gap-2"
          >
            <p className="font-bold text-bmos-text">{r.className}</p>
            <p className="text-xs text-bmos-text-light">
              👤 {r.studentName}
              {r.classType === "SEMINAR" ? " · Seminar" : " · Reguler"}
            </p>
            {r.price && (
              <p className="text-xs text-bmos-text-light">{formatRupiah(r.price)}</p>
            )}

            {r.paymentProofUrl && (
              <a href={r.paymentProofUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={r.paymentProofUrl}
                  alt="Bukti transfer"
                  className="w-full h-32 object-cover rounded-xl border border-bmos-border"
                />
              </a>
            )}

            {r.aiPaymentNote && (
              <p className="text-xs bg-bmos-primary-soft text-bmos-text rounded-lg px-2.5 py-1.5">
                🤖 {r.aiPaymentNote}
              </p>
            )}

            {message?.id === r.enrollmentId && (
              <p
                className={`text-xs rounded-lg px-2.5 py-1.5 ${
                  message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                }`}
              >
                {message.text}
              </p>
            )}

            {rejectingId === r.enrollmentId ? (
              <div className="flex flex-col gap-1.5">
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Alasan penolakan buat Murid..."
                  rows={2}
                  className="w-full border border-bmos-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(r.enrollmentId)}
                    disabled={busyId === r.enrollmentId || !rejectNote.trim()}
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
                  onClick={() => handleApprove(r.enrollmentId)}
                  disabled={busyId === r.enrollmentId}
                  className="flex-1 bg-bmos-primary text-white rounded-xl py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-50"
                >
                  {busyId === r.enrollmentId ? "Memproses..." : "Setujui"}
                </button>
                <button
                  onClick={() => setRejectingId(r.enrollmentId)}
                  disabled={busyId === r.enrollmentId}
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
