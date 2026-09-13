"use client";

// Server component sederhana (ga ada interaksi) -- Laoshi CUMA dikasih
// pdf_file_url lewat props (lihat app/(app)/materials/page.tsx, query-nya
// SENGAJA ga select kolom original_file_* sama sekali buat role Laoshi),
// jadi ga ada cara buat Laoshi dapetin file aslinya dari halaman ini.
//
// Dijadiin client component biar bisa nampilin modal "Beli PPT" (upload
// bukti transfer) buat bahan ajar yang dikasih harga sama BM --
// SENGAJA dibikin beda visual (badge kuning/amber "Berbayar", bukan ungu
// kayak badge Seminar di Class Card) biar Laoshi ga ketuker sama fitur
// Join Kelas.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { requestPurchaseResource, MyResourcePurchase } from "./actions";
import { BANK_ACCOUNT } from "@/lib/paymentProof";

type Resource = {
  id: string;
  title: string;
  description: string | null;
  pdf_file_url: string;
  pdf_file_name: string | null;
  price: number | null;
  created_at: string;
};

function formatRupiah(n: number | null | undefined): string {
  if (!n) return "-";
  return `Rp ${n.toLocaleString("id-ID")}`;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "⏳ Menunggu Review BM",
  REJECTED: "❌ Ditolak",
};
const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function TeacherResourceList({
  resources,
  myPurchases = [],
}: {
  resources: Resource[];
  myPurchases?: MyResourcePurchase[];
}) {
  const [modalResource, setModalResource] = useState<Resource | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ id: string; text: string; ok: boolean } | null>(
    null
  );

  function purchaseFor(resourceId: string): MyResourcePurchase | undefined {
    // Kalau ada lebih dari 1 (misal pernah ditolak terus request lagi),
    // ambil yang paling relevan: APPROVED > PENDING > REJECTED.
    const forThis = myPurchases.filter((p) => p.resourceId === resourceId);
    return (
      forThis.find((p) => p.requestStatus === "APPROVED") ||
      forThis.find((p) => p.requestStatus === "PENDING") ||
      forThis[0]
    );
  }

  function openModal(r: Resource) {
    setModalResource(r);
    setFile(null);
    setModalError("");
    setCopied(false);
  }

  function closeModal() {
    setModalResource(null);
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
      // Clipboard API bisa gagal -- Laoshi masih bisa select-copy manual.
    }
  }

  async function handleSubmitRequest() {
    if (!modalResource) return;
    if (!file) {
      setModalError("Upload bukti transfer dulu ya.");
      return;
    }

    setUploading(true);
    setModalError("");

    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${modalResource.id}/${Date.now()}_${safeName}`;

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

      const result = await requestPurchaseResource(modalResource.id, {
        fileUrl: publicUrlData.publicUrl,
        fileName: file.name,
        filePath: path,
      });

      setUploading(false);
      setMessage({ id: modalResource.id, text: result.message, ok: result.success });
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

  return (
    <div className="bg-white border border-bmos-border rounded-2xl p-6">
      <h2 className="font-bold text-bmos-text text-lg mb-1">
        Bahan Ajar dari BM
      </h2>
      <p className="text-xs text-bmos-text-light mb-4">
        Cuma bisa dilihat/didownload dalam bentuk PDF -- dipakai sebagai
        bahan ngajar ke Murid. Beberapa bahan ajar berbayar (ditandai
        badge kuning) -- perlu transfer & upload bukti dulu sebelum bisa
        didownload.
      </p>

      {resources.length === 0 ? (
        <p className="text-sm text-bmos-text-light text-center py-8">
          Belum ada bahan ajar dari BM.
        </p>
      ) : (
        <div className="space-y-3">
          {resources.map((r) => {
            const isPaid = !!r.price && r.price > 0;
            const purchase = isPaid ? purchaseFor(r.id) : undefined;
            const unlocked = !isPaid || purchase?.requestStatus === "APPROVED";

            return (
              <div key={r.id} className="border-b border-bmos-border last:border-0 pb-3 last:pb-0">
                <p className="text-sm font-semibold text-bmos-text flex items-center gap-1.5 flex-wrap">
                  {r.title}
                  {isPaid && (
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      💰 Berbayar · {formatRupiah(r.price)}
                    </span>
                  )}
                </p>
                {r.description && (
                  <p className="text-sm text-bmos-text-light mt-1">{r.description}</p>
                )}

                {message?.id === r.id && (
                  <p
                    className={`text-xs rounded-lg px-2.5 py-1.5 mt-1.5 ${
                      message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                    }`}
                  >
                    {message.text}
                  </p>
                )}

                {unlocked ? (
                  <a
                    href={r.pdf_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-bmos-primary hover:underline mt-1 inline-block"
                  >
                    📄 {r.pdf_file_name || "Buka PDF"}
                  </a>
                ) : (
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {purchase && purchase.requestStatus !== "REJECTED" ? (
                      <span
                        className={`text-[11px] font-semibold px-2 py-1 rounded-full ${STATUS_STYLE[purchase.requestStatus]}`}
                      >
                        {STATUS_LABEL[purchase.requestStatus]}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openModal(r)}
                        className="text-xs font-semibold text-white bg-amber-600 rounded-lg px-3 py-1.5 hover:bg-amber-700 transition"
                      >
                        💰 Beli PPT Ini
                      </button>
                    )}
                    {purchase?.requestStatus === "REJECTED" && purchase.rejectionNote && (
                      <span className="text-xs text-red-600">
                        Ditolak: {purchase.rejectionNote}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-bmos-text text-lg mb-1">
              Beli {modalResource.title}
            </h3>
            <p className="text-sm text-bmos-text-light mb-3">
              Biaya: {formatRupiah(modalResource.price)}. Mohon ditransfer
              ke rekening berikut, lalu upload bukti transfernya di bawah
              ini ya.
            </p>

            <div className="bg-amber-50 rounded-xl px-4 py-3 mb-4 text-sm text-bmos-text">
              <p className="font-semibold">{BANK_ACCOUNT.bank}</p>
              <p>a/n {BANK_ACCOUNT.holder}</p>
              <button
                type="button"
                onClick={handleCopyAccountNumber}
                className="flex items-center gap-2 font-bold tracking-wide mt-0.5 hover:opacity-80 transition"
                title="Salin nomor rekening"
              >
                {BANK_ACCOUNT.number}
                <span className="text-xs font-semibold text-amber-700">
                  {copied ? "✓ Disalin" : "Salin"}
                </span>
              </button>
            </div>

            <label
              htmlFor="resource-payment-proof-input"
              className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-bmos-border rounded-xl px-4 py-6 cursor-pointer text-center hover:border-amber-400 transition"
            >
              <span className="text-sm font-semibold text-amber-700">
                {file ? "Ganti File" : "Pilih Bukti Transfer"}
              </span>
              <span className="text-xs text-bmos-text-light">
                {file ? file.name : "Foto/screenshot bukti transfer (JPG/PNG)"}
              </span>
            </label>
            <input
              id="resource-payment-proof-input"
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
                className="flex-1 bg-amber-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-amber-700 transition disabled:opacity-50"
              >
                {uploading ? "Mengirim..." : "Kirim Request Beli"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
