"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { requestJoinClassCard, submitMonthlyPayment, MyClassEnrollment } from "./actions";
import { ClassCard, formatRupiah } from "@/lib/classCards";
import { BANK_ACCOUNT } from "@/lib/paymentProof";
import { computeCycleAmount } from "@/lib/monthlyBilling";

const REQUEST_STATUS_LABEL: Record<string, string> = {
  PENDING: "⏳ Menunggu Review BM",
  APPROVED: "✅ Aktif",
  REJECTED: "❌ Ditolak",
};

const REQUEST_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

function timeRangesOverlap(
  aStart?: string | null,
  aEnd?: string | null,
  bStart?: string | null,
  bEnd?: string | null
): boolean {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart < bEnd && bStart < aEnd;
}

export default function StudentClassBrowse({
  cards,
  countByClass,
  myEnrollments,
  disabled,
  registrationFormUrl,
}: {
  cards: ClassCard[];
  countByClass: Record<string, number>;
  myEnrollments: MyClassEnrollment[];
  disabled?: boolean;
  registrationFormUrl?: string | null;
}) {
  const [modalCard, setModalCard] = useState<ClassCard | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [copied, setCopied] = useState(false);
  const [cycleMonths, setCycleMonths] = useState<1 | 3>(1);
  const [message, setMessage] = useState<{ id: string; text: string; ok: boolean } | null>(
    null
  );

  // Modal bayar bulanan LANJUTAN (bukan join pertama) -- dipakai dari
  // section "Kelas Kamu" pas Murid klik "Bayar Sekarang" buat kelas
  // billing_type MONTHLY yang udah aktif.
  const [payingEnrollment, setPayingEnrollment] = useState<MyClassEnrollment | null>(null);
  const [payCycleMonths, setPayCycleMonths] = useState<1 | 3>(1);
  const [payFile, setPayFile] = useState<File | null>(null);
  const [payUploading, setPayUploading] = useState(false);
  const [payError, setPayError] = useState("");
  const [payCopied, setPayCopied] = useState(false);
  const [payMessage, setPayMessage] = useState<{ id: string; text: string; ok: boolean } | null>(
    null
  );

  const today = new Date().toISOString().slice(0, 10);

  // Kelas yang pendaftarannya udah ditutup (registration_end udah lewat)
  // ga usah ditampilin sama sekali di sisi Murid -- daripada nampilin
  // kartu abu-abu "Pendaftaran sudah ditutup" yang cuma bikin bingung,
  // mending langsung ilang aja dari daftar kayak kelas itu ga ada.
  cards = cards.filter((c) => !(c.registration_end && today > c.registration_end));

  // Kelas aktif/lagi diproses Murid (PENDING/APPROVED aja -- REJECTED
  // ga dianggap "punya kelas" lagi, dan ga ikut ngeblokir join yang baru).
  const activeOrPending = myEnrollments.filter(
    (e) => e.requestStatus === "PENDING" || e.requestStatus === "APPROVED"
  );
  const hasRegularActiveOrPending = activeOrPending.some((e) => e.classType === "REGULAR");

  function conflictReason(c: ClassCard): string | null {
    if (c.class_type === "REGULAR" && hasRegularActiveOrPending) {
      return "Kamu sudah punya kelas Reguler aktif/lagi diproses.";
    }
    const clash = activeOrPending.find(
      (e) =>
        e.dayOfWeek &&
        c.day_of_week &&
        e.dayOfWeek === c.day_of_week &&
        timeRangesOverlap(c.start_time, c.end_time, e.startTime, e.endTime)
    );
    if (clash) {
      return `Jadwal bentrok sama "${clash.className}".`;
    }
    if (activeOrPending.some((e) => e.classId === c.id)) {
      return "Kamu sudah request/aktif di kelas ini.";
    }
    return null;
  }

  function openModal(card: ClassCard) {
    if (disabled) return;
    setModalCard(card);
    setFile(null);
    setModalError("");
    setCopied(false);
    setCycleMonths(1);
  }

  function closeModal() {
    setModalCard(null);
    setFile(null);
    setModalError("");
    setUploading(false);
  }

  async function handleCopyAccountNumber() {
    try {
      await navigator.clipboard.writeText(BANK_ACCOUNT.number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API bisa gagal (browser lama/permission) -- Murid masih
      // bisa select-copy manual dari teksnya, jadi ga perlu ditampilin error.
    }
  }

  async function handleSubmitRequest() {
    if (!modalCard) return;
    if (!file) {
      setModalError("Upload bukti transfer dulu ya.");
      return;
    }

    setUploading(true);
    setModalError("");

    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${modalCard.id}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file);

      if (uploadError) {
        setModalError(`Gagal upload bukti transfer: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(path);

      const result = await requestJoinClassCard(
        modalCard.id,
        {
          fileUrl: publicUrlData.publicUrl,
          fileName: file.name,
          filePath: path,
        },
        modalCard.billing_type === "MONTHLY" ? cycleMonths : 1
      );

      setUploading(false);
      setMessage({ id: modalCard.id, text: result.message, ok: result.success });
      if (result.success) {
        closeModal();
      } else {
        setModalError(result.message);
      }
    } catch (err) {
      setUploading(false);
      setModalError(err instanceof Error ? err.message : "Gagal mengirim request.");
    }
  }

  function openPayModal(e: MyClassEnrollment) {
    setPayingEnrollment(e);
    setPayCycleMonths(1);
    setPayFile(null);
    setPayError("");
    setPayCopied(false);
  }

  function closePayModal() {
    setPayingEnrollment(null);
    setPayFile(null);
    setPayError("");
    setPayUploading(false);
  }

  async function handleCopyAccountNumberPay() {
    try {
      await navigator.clipboard.writeText(BANK_ACCOUNT.number);
      setPayCopied(true);
      setTimeout(() => setPayCopied(false), 1500);
    } catch {
      // Sama kayak handleCopyAccountNumber -- ga masalah kalau Clipboard
      // API-nya gagal, Murid masih bisa select-copy manual.
    }
  }

  async function handleSubmitMonthlyPayment() {
    if (!payingEnrollment) return;
    if (!payFile) {
      setPayError("Upload bukti transfer dulu ya.");
      return;
    }

    setPayUploading(true);
    setPayError("");

    try {
      const supabase = createClient();
      const safeName = payFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${payingEnrollment.classId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(path, payFile);

      if (uploadError) {
        setPayError(`Gagal upload bukti transfer: ${uploadError.message}`);
        setPayUploading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(path);

      const result = await submitMonthlyPayment(payingEnrollment.enrollmentId, payCycleMonths, {
        fileUrl: publicUrlData.publicUrl,
        fileName: payFile.name,
        filePath: path,
      });

      setPayUploading(false);
      setPayMessage({
        id: payingEnrollment.enrollmentId,
        text: result.message,
        ok: result.success,
      });
      if (result.success) {
        closePayModal();
      } else {
        setPayError(result.message);
      }
    } catch (err) {
      setPayUploading(false);
      setPayError(err instanceof Error ? err.message : "Gagal mengirim bukti bayar.");
    }
  }

  const registrationBanner = registrationFormUrl && (
    <a
      href={registrationFormUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-bmos-primary-soft border border-bmos-primary-light rounded-2xl p-4 mb-4 text-sm text-bmos-text hover:opacity-90 transition"
    >
      <p className="font-semibold text-bmos-primary">
        📝 Belum yakin kelas mana yang cocok?
      </p>
      <p className="text-bmos-text-light mt-0.5">
        Isi kuisioner ini dulu biar kami bantu arahkan ke kelas yang sesuai
        tujuan belajar kamu →
      </p>
    </a>
  );

  const myRequestsSection = myEnrollments.length > 0 && (
    <div className="mb-6">
      <p className="text-sm font-semibold text-bmos-text mb-2">Kelas Kamu</p>
      <div className="flex flex-col gap-2">
        {myEnrollments.map((e) => (
          <div
            key={e.enrollmentId}
            className="bg-white border border-bmos-border rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
          >
            <div>
              <p className="text-sm font-semibold text-bmos-text">
                {e.className}
                <span className="text-xs font-normal text-bmos-text-light">
                  {e.classType === "SEMINAR" ? " · Seminar" : " · Reguler"}
                </span>
              </p>
              {e.requestStatus === "REJECTED" && e.rejectionNote && (
                <p className="text-xs text-red-600 mt-0.5">Alasan: {e.rejectionNote}</p>
              )}
              {e.requestStatus === "PENDING" && e.aiPaymentNote && (
                <p className="text-xs text-bmos-text-light mt-0.5">🤖 {e.aiPaymentNote}</p>
              )}
              {e.requestStatus === "APPROVED" && e.billingType === "MONTHLY" && (
                <>
                  {e.nextDueDate && (
                    <p className="text-xs text-bmos-text-light mt-0.5">
                      📅 Jatuh tempo berikutnya: {e.nextDueDate}
                    </p>
                  )}
                  <button
                    onClick={() => openPayModal(e)}
                    className="text-xs font-semibold text-bmos-primary hover:underline mt-0.5"
                  >
                    💳 Bayar Sekarang
                  </button>
                  {payMessage?.id === e.enrollmentId && (
                    <p
                      className={`text-xs rounded-lg px-2 py-1 mt-1 ${
                        payMessage.ok
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {payMessage.text}
                    </p>
                  )}
                </>
              )}
            </div>
            <span
              className={`text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${REQUEST_STATUS_STYLE[e.requestStatus]}`}
            >
              {REQUEST_STATUS_LABEL[e.requestStatus]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  if (cards.length === 0) {
    return (
      <div>
        {registrationBanner}
        {myRequestsSection}
        <div className="bg-white border border-bmos-border rounded-2xl p-10 text-center text-sm text-bmos-text-light">
          Belum ada kelas yang bisa dipilih saat ini.
        </div>
      </div>
    );
  }

  return (
    <div>
      {registrationBanner}
      {myRequestsSection}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const filled = countByClass[c.id] ?? 0;
          const isFull = filled >= c.capacity_max;
          const notOpenYet = c.registration_start && today < c.registration_start;
          const closed = c.registration_end && today > c.registration_end;
          const conflict = conflictReason(c);
          const canJoin = !isFull && !notOpenYet && !closed && !disabled && !conflict;

          return (
            <div
              key={c.id}
              className="bg-white border border-bmos-border rounded-2xl p-4 flex flex-col gap-2"
            >
              <p className="font-bold text-bmos-text flex items-center gap-1.5 flex-wrap">
                {c.name}
                {c.is_private && (
                  <span className="text-[10px] font-semibold bg-bmos-primary-soft text-bmos-primary px-2 py-0.5 rounded-full">
                    Private
                  </span>
                )}
                {c.class_type === "SEMINAR" && (
                  <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                    Seminar
                  </span>
                )}
              </p>
              <p className="text-xs text-bmos-text-light">
                👩‍🏫 {c.teacher_name || "-"}
              </p>
              <p className="text-xs text-bmos-text-light">
                {c.day_of_week
                  ? `${c.day_of_week} · ${c.start_time?.slice(0, 5) || ""}-${
                      c.end_time?.slice(0, 5) || ""
                    }`
                  : "Jadwal belum diatur"}
              </p>
              {c.start_date && (
                <p className="text-xs text-bmos-text-light">
                  📅 Kelas mulai{" "}
                  {new Date(c.start_date).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}

              {c.description && (
                <p className="text-xs text-bmos-text-light">{c.description}</p>
              )}

              {(c.goal_tags?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.goal_tags!.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-semibold bg-bmos-primary-soft text-bmos-primary px-2 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {c.billing_type === "MONTHLY" ? (
                c.monthly_price && (
                  <p className="text-sm font-semibold text-bmos-text">
                    {formatRupiah(c.monthly_price)}{" "}
                    <span className="font-normal text-xs text-bmos-text-light">/ bulan</span>
                  </p>
                )
              ) : (
                c.price && (
                  <p className="text-sm font-semibold text-bmos-text">
                    {formatRupiah(c.price)}{" "}
                    <span className="font-normal text-xs text-bmos-text-light">
                      / {c.sessions_count ?? "-"} sesi
                    </span>
                  </p>
                )
              )}

              <p className="text-xs text-bmos-text-light">
                Kuota: {filled}/{c.capacity_max}
                {isFull ? " · Penuh" : ""}
              </p>

              {notOpenYet && (
                <p className="text-xs text-yellow-700">
                  Pendaftaran dibuka {c.registration_start}
                </p>
              )}
              {closed && !notOpenYet && (
                <p className="text-xs text-red-600">Pendaftaran sudah ditutup</p>
              )}
              {conflict && !isFull && !notOpenYet && !closed && (
                <p className="text-xs text-yellow-700">{conflict}</p>
              )}

              {message?.id === c.id && (
                <p
                  className={`text-xs rounded-lg px-2.5 py-1.5 ${
                    message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                  }`}
                >
                  {message.text}
                </p>
              )}

              <button
                onClick={() => openModal(c)}
                disabled={!canJoin}
                className="mt-1 bg-bmos-primary text-white rounded-xl py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFull ? "Kelas Penuh" : "Join Kelas"}
              </button>
            </div>
          );
        })}
      </div>

      {modalCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-bmos-text text-lg mb-1">
              Join {modalCard.name}
            </h3>

            {modalCard.billing_type === "MONTHLY" ? (
              <>
                <p className="text-sm text-bmos-text-light mb-2">
                  Kelas ini bayar bulanan. Pilih mau bayar berapa bulan
                  sekarang:
                </p>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setCycleMonths(1)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      cycleMonths === 1
                        ? "bg-bmos-primary text-white border-bmos-primary"
                        : "border-bmos-border text-bmos-text-light"
                    }`}
                  >
                    1 Bulan
                    <br />
                    {formatRupiah(computeCycleAmount(modalCard.monthly_price ?? 0, 1, modalCard.three_month_discount_pct ?? 0))}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCycleMonths(3)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      cycleMonths === 3
                        ? "bg-bmos-primary text-white border-bmos-primary"
                        : "border-bmos-border text-bmos-text-light"
                    }`}
                  >
                    3 Bulan
                    <br />
                    {formatRupiah(computeCycleAmount(modalCard.monthly_price ?? 0, 3, modalCard.three_month_discount_pct ?? 0))}
                    {(modalCard.three_month_discount_pct ?? 0) > 0 && (
                      <span className="block font-normal">
                        (diskon {modalCard.three_month_discount_pct}%)
                      </span>
                    )}
                  </button>
                </div>
                <p className="text-sm text-bmos-text-light mb-3">
                  Mohon ditransfer ke rekening berikut, lalu upload bukti
                  transfernya di bawah ini ya.
                </p>
              </>
            ) : (
              <p className="text-sm text-bmos-text-light mb-3">
                {modalCard.price
                  ? `Biaya: ${formatRupiah(modalCard.price)}. Mohon ditransfer ke rekening berikut, lalu upload bukti transfernya di bawah ini ya.`
                  : "Upload bukti transfer/pembayaran kamu di bawah ini ya."}
              </p>
            )}

            {(modalCard.billing_type === "MONTHLY" || modalCard.price) && (
              <div className="bg-bmos-primary-soft rounded-xl px-4 py-3 mb-4 text-sm text-bmos-text">
                <p className="font-semibold">{BANK_ACCOUNT.bank}</p>
                <p>a/n {BANK_ACCOUNT.holder}</p>
                <button
                  type="button"
                  onClick={handleCopyAccountNumber}
                  className="flex items-center gap-2 font-bold tracking-wide mt-0.5 hover:opacity-80 transition"
                  title="Salin nomor rekening"
                >
                  {BANK_ACCOUNT.number}
                  <span className="text-xs font-semibold text-bmos-primary">
                    {copied ? "✓ Disalin" : "Salin"}
                  </span>
                </button>
              </div>
            )}

            <label
              htmlFor="payment-proof-input"
              className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-bmos-border rounded-xl px-4 py-6 cursor-pointer text-center hover:border-bmos-primary-light transition"
            >
              <span className="text-sm font-semibold text-bmos-primary">
                {file ? "Ganti File" : "Pilih Bukti Transfer"}
              </span>
              <span className="text-xs text-bmos-text-light">
                {file ? file.name : "Foto/screenshot bukti transfer (JPG/PNG)"}
              </span>
            </label>
            <input
              id="payment-proof-input"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />

            {modalError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 mt-3">
                {modalError}
              </p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={closeModal}
                disabled={uploading}
                className="flex-1 border border-bmos-border rounded-xl py-2.5 text-sm font-semibold text-bmos-text-light disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={uploading || !file}
                className="flex-1 bg-bmos-primary text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-50"
              >
                {uploading ? "Mengirim..." : "Kirim Request Join"}
              </button>
            </div>
          </div>
        </div>
      )}

      {payingEnrollment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-bmos-text text-lg mb-1">
              Bayar {payingEnrollment.className}
            </h3>
            <p className="text-sm text-bmos-text-light mb-2">
              Pilih mau bayar berapa bulan sekarang:
            </p>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setPayCycleMonths(1)}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  payCycleMonths === 1
                    ? "bg-bmos-primary text-white border-bmos-primary"
                    : "border-bmos-border text-bmos-text-light"
                }`}
              >
                1 Bulan
              </button>
              <button
                type="button"
                onClick={() => setPayCycleMonths(3)}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  payCycleMonths === 3
                    ? "bg-bmos-primary text-white border-bmos-primary"
                    : "border-bmos-border text-bmos-text-light"
                }`}
              >
                3 Bulan
              </button>
            </div>
            <p className="text-sm text-bmos-text-light mb-3">
              Mohon ditransfer ke rekening berikut, lalu upload bukti
              transfernya di bawah ini ya.
            </p>

            <div className="bg-bmos-primary-soft rounded-xl px-4 py-3 mb-4 text-sm text-bmos-text">
              <p className="font-semibold">{BANK_ACCOUNT.bank}</p>
              <p>a/n {BANK_ACCOUNT.holder}</p>
              <button
                type="button"
                onClick={handleCopyAccountNumberPay}
                className="flex items-center gap-2 font-bold tracking-wide mt-0.5 hover:opacity-80 transition"
                title="Salin nomor rekening"
              >
                {BANK_ACCOUNT.number}
                <span className="text-xs font-semibold text-bmos-primary">
                  {payCopied ? "✓ Disalin" : "Salin"}
                </span>
              </button>
            </div>

            <label
              htmlFor="monthly-payment-proof-input"
              className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-bmos-border rounded-xl px-4 py-6 cursor-pointer text-center hover:border-bmos-primary-light transition"
            >
              <span className="text-sm font-semibold text-bmos-primary">
                {payFile ? "Ganti File" : "Pilih Bukti Transfer"}
              </span>
              <span className="text-xs text-bmos-text-light">
                {payFile ? payFile.name : "Foto/screenshot bukti transfer (JPG/PNG)"}
              </span>
            </label>
            <input
              id="monthly-payment-proof-input"
              type="file"
              accept="image/*"
              onChange={(e) => setPayFile(e.target.files?.[0] || null)}
              className="hidden"
            />

            {payError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 mt-3">
                {payError}
              </p>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={closePayModal}
                disabled={payUploading}
                className="flex-1 border border-bmos-border rounded-xl py-2.5 text-sm font-semibold text-bmos-text-light disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitMonthlyPayment}
                disabled={payUploading || !payFile}
                className="flex-1 bg-bmos-primary text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-50"
              >
                {payUploading ? "Mengirim..." : "Kirim Bukti Bayar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
