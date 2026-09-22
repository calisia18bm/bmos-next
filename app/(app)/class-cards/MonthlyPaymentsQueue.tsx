"use client";

import { useState } from "react";
import Image from "next/image";
import {
  approveMonthlyPayment,
  rejectMonthlyPayment,
  PendingMonthlyPayment,
} from "./actions";
import { formatRupiah } from "@/lib/classCards";

// Widget buat Owner/Admin di halaman Class Card -- daftar bukti bayar
// BULANAN (kelas lanjutan, bukan join pertama) yang lagi PENDING, sama
// persis kayak JoinRequestsQueue tapi buat kelas billing_type='MONTHLY'.
export default function MonthlyPaymentsQueue({
  payments,
}: {
  payments: PendingMonthlyPayment[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [message, setMessage] = useState<{ id: string; text: string; ok: boolean } | null>(
    null
  );

  async function handleApprove(id: string) {
    setBusyId(id);
    const result = await approveMonthlyPayment(id);
    setBusyId(null);
    setMessage({ id, text: result.message, ok: result.success });
  }

  async function handleReject(id: string) {
    if (!rejectNote.trim()) return;
    setBusyId(id);
    const result = await rejectMonthlyPayment(id, rejectNote);
    setBusyId(null);
    setMessage({ id, text: result.message, ok: result.success });
    if (result.success) {
      setRejectingId(null);
      setRejectNote("");
    }
  }

  if (payments.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold text-bmos-text mb-1">
        💰 Bukti Bayar Bulanan{" "}
        <span className="text-sm font-semibold text-white bg-bmos-primary rounded-full px-2 py-0.5 align-middle">
          {payments.length}
        </span>
      </h2>
      <p className="text-bmos-text-light text-sm mb-4">
        Murid yang udah join kelas bulanan upload bukti bayar lanjutan --
        cek bukti bayarnya (ada bantuan baca dari AI, tapi keputusan
        approve/reject tetap kamu yang pegang) sebelum klik Setujui.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {payments.map((p) => (
          <div
            key={p.paymentId}
            className="bg-white border border-bmos-border rounded-2xl p-4 flex flex-col gap-2"
          >
            <p className="font-bold text-bmos-text">{p.className}</p>
            <p className="text-xs text-bmos-text-light">
              👤 {p.studentName} · {p.cycleMonths === 3 ? "3 bulan sekaligus" : "per bulan"}
            </p>
            {p.amount != null && (
              <p className="text-xs text-bmos-text-light">{formatRupiah(p.amount)}</p>
            )}

            {p.paymentProofUrl && (
              <a
                href={p.paymentProofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block w-full h-32 rounded-xl border border-bmos-border overflow-hidden"
              >
                <Image
                  src={p.paymentProofUrl}
                  alt="Bukti transfer"
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover"
                />
              </a>
            )}

            {p.aiPaymentNote && (
              <p className="text-xs bg-bmos-primary-soft text-bmos-text rounded-lg px-2.5 py-1.5">
                🤖 {p.aiPaymentNote}
              </p>
            )}

            {message?.id === p.paymentId && (
              <p
                className={`text-xs rounded-lg px-2.5 py-1.5 ${
                  message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                }`}
              >
                {message.text}
              </p>
            )}

            {rejectingId === p.paymentId ? (
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
                    onClick={() => handleReject(p.paymentId)}
                    disabled={busyId === p.paymentId || !rejectNote.trim()}
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
                  onClick={() => handleApprove(p.paymentId)}
                  disabled={busyId === p.paymentId}
                  className="flex-1 bg-bmos-primary text-white rounded-xl py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-50"
                >
                  {busyId === p.paymentId ? "Memproses..." : "Setujui"}
                </button>
                <button
                  onClick={() => setRejectingId(p.paymentId)}
                  disabled={busyId === p.paymentId}
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
