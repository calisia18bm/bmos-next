"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createTeacherResource,
  deleteTeacherResource,
  approveTeacherResourceSubmission,
  rejectTeacherResourceSubmission,
} from "./actions";

type Resource = {
  id: string;
  title: string;
  description: string | null;
  pdf_file_url: string;
  pdf_file_name: string | null;
  original_file_url: string | null;
  original_file_name: string | null;
  uploaded_by_name: string | null;
  created_at: string;
};

type Submission = {
  id: string;
  teacher_name: string | null;
  title: string;
  description: string | null;
  submitted_file_url: string;
  submitted_file_name: string | null;
  status: string;
  rejection_note: string | null;
  created_at: string;
};

// Panel review 1 submission -- Admin/Owner download draft-nya, cek/edit
// sendiri di luar, terus upload versi PDF final buat approve (otomatis
// dipublish ke teacher_resources, bisa dipakai SEMUA Laoshi). Bisa juga
// reject dengan catatan biar Laoshi tau harus perbaiki apa.
function SubmissionReviewRow({ s }: { s: Submission }) {
  const router = useRouter();
  const [reviewing, setReviewing] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function uploadFile(file: File) {
    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("teacher-resources")
      .upload(path, file);
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabase.storage.from("teacher-resources").getPublicUrl(path);
    return { url: data.publicUrl, name: file.name, path };
  }

  async function handleApprove() {
    setError("");
    if (!pdfFile) {
      setError("Upload versi PDF final dulu buat approve.");
      return;
    }
    setBusy(true);
    try {
      const pdf = await uploadFile(pdfFile);
      const original = originalFile ? await uploadFile(originalFile) : null;
      const res = await approveTeacherResourceSubmission(s.id, {
        pdfFileUrl: pdf.url,
        pdfFileName: pdf.name,
        pdfFilePath: pdf.path,
        originalFileUrl: original?.url || "",
        originalFileName: original?.name || "",
        originalFilePath: original?.path || "",
      });
      if (!res.success) {
        setError(res.message);
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal upload file.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    setError("");
    setBusy(true);
    const res = await rejectTeacherResourceSubmission(s.id, rejectNote);
    setBusy(false);
    if (!res.success) {
      setError(res.message);
      return;
    }
    setShowReject(false);
    setRejectNote("");
    router.refresh();
  }

  return (
    <div className="border border-yellow-200 bg-yellow-50/50 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-bmos-text">{s.title}</p>
          {s.teacher_name && (
            <p className="text-xs text-bmos-text-light">dari {s.teacher_name}</p>
          )}
        </div>
        <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
          Menunggu Review
        </span>
      </div>
      {s.description && (
        <p className="text-sm text-bmos-text-light mt-1">{s.description}</p>
      )}
      <a
        href={s.submitted_file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-semibold text-bmos-primary hover:underline mt-1 inline-block"
      >
        📎 Download draft: {s.submitted_file_name || "buka file"}
      </a>

      {!reviewing && !showReject && (
        <div className="flex gap-3 mt-3">
          <button
            type="button"
            onClick={() => setReviewing(true)}
            className="text-xs font-semibold text-white bg-bmos-primary rounded-lg px-3 py-1.5 hover:bg-bmos-primary-light transition"
          >
            ✅ Setujui & Upload PDF
          </button>
          <button
            type="button"
            onClick={() => setShowReject(true)}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            Tolak
          </button>
        </div>
      )}

      {reviewing && (
        <div className="mt-3 border-t border-yellow-200 pt-3 space-y-2">
          <p className="text-xs text-bmos-text-light">
            Cek/edit dulu file draft-nya di luar (misal PowerPoint), terus
            upload versi PDF final di sini -- ini yang bakal dilihat semua
            Laoshi.
          </p>
          <div>
            <label className="block text-xs font-medium text-bmos-text mb-1">
              File PDF Final (wajib)
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              className="text-xs w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-bmos-text mb-1">
              File Asli Hasil Edit (opsional, arsip Owner/Admin)
            </label>
            <input
              type="file"
              onChange={(e) => setOriginalFile(e.target.files?.[0] || null)}
              className="text-xs w-full"
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1.5">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setReviewing(false)}
              className="text-xs text-bmos-text-light hover:text-bmos-text px-2 py-1.5"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={busy}
              className="text-xs font-semibold text-white bg-green-600 rounded-lg px-3 py-1.5 hover:bg-green-700 transition disabled:opacity-60"
            >
              {busy ? "Memproses..." : "Publish jadi PDF"}
            </button>
          </div>
        </div>
      )}

      {showReject && (
        <div className="mt-3 border-t border-yellow-200 pt-3 space-y-2">
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Catatan alasan penolakan buat Laoshi..."
            rows={2}
            className="w-full border border-bmos-border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
          />
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1.5">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowReject(false)}
              className="text-xs text-bmos-text-light hover:text-bmos-text px-2 py-1.5"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={busy}
              className="text-xs font-semibold text-white bg-red-600 rounded-lg px-3 py-1.5 hover:bg-red-700 transition disabled:opacity-60"
            >
              {busy ? "Memproses..." : "Tolak Submission"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Owner/Admin upload bahan ajar buat Laoshi -- WAJIB upload versi PDF
// (yang bakal dilihat Laoshi), file asli (PPT/dll) OPSIONAL, cuma buat
// arsip Owner/Admin sendiri, Laoshi ga pernah dikasih akses ke file asli.
// Panel ini juga nampilin submission materi dari Laoshi yang lagi
// nunggu direview (lihat SubmissionReviewRow di atas).
export default function TeacherResourceManage({
  resources,
  submissions = [],
}: {
  resources: Resource[];
  submissions?: Submission[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const pendingSubmissions = submissions.filter((s) => s.status === "PENDING");

  async function uploadFile(file: File) {
    const supabase = createClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const path = `${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("teacher-resources")
      .upload(path, file);
    if (uploadError) throw new Error(uploadError.message);
    const { data } = supabase.storage.from("teacher-resources").getPublicUrl(path);
    return { url: data.publicUrl, name: file.name, path };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!pdfFile) {
      setError("File PDF wajib diupload (ini yang bakal dilihat Laoshi).");
      return;
    }

    setUploading(true);
    try {
      const pdf = await uploadFile(pdfFile);
      const original = originalFile ? await uploadFile(originalFile) : null;

      const res = await createTeacherResource({
        title,
        description,
        pdfFileUrl: pdf.url,
        pdfFileName: pdf.name,
        pdfFilePath: pdf.path,
        originalFileUrl: original?.url || "",
        originalFileName: original?.name || "",
        originalFilePath: original?.path || "",
      });

      if (!res.success) {
        setError(res.message);
        return;
      }

      setTitle("");
      setDescription("");
      setPdfFile(null);
      setOriginalFile(null);
      const pdfInput = document.getElementById("resource-pdf-input") as HTMLInputElement | null;
      if (pdfInput) pdfInput.value = "";
      const origInput = document.getElementById("resource-original-input") as HTMLInputElement | null;
      if (origInput) origInput.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal upload file.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteTeacherResource(id);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {pendingSubmissions.length > 0 && (
        <div className="bg-white border border-bmos-border rounded-2xl p-6">
          <h2 className="font-bold text-bmos-text text-lg mb-1">
            Submission Materi dari Laoshi ({pendingSubmissions.length})
          </h2>
          <p className="text-xs text-bmos-text-light mb-4">
            Laoshi submit draft materi mereka -- cek/edit, terus approve
            dengan upload versi PDF final biar bisa dipakai semua Laoshi,
            atau tolak dengan catatan.
          </p>
          <div className="space-y-3">
            {pendingSubmissions.map((s) => (
              <SubmissionReviewRow key={s.id} s={s} />
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-bmos-border rounded-2xl p-6">
        <h2 className="font-bold text-bmos-text text-lg mb-1">
          Upload Bahan Ajar buat Laoshi
        </h2>
        <p className="text-xs text-bmos-text-light mb-4">
          Laoshi CUMA bisa lihat & download versi PDF -- file asli (PPT/dll)
          cuma kesimpen buat arsip Owner/Admin, ga bisa diakses Laoshi.
          Kalau filenya PPT, save as PDF dulu sebelum upload di sini.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul bahan ajar"
            required
            className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Keterangan (opsional)"
            rows={2}
            className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
          />

          <div>
            <label className="block text-sm font-medium text-bmos-text mb-1">
              File PDF (yang dilihat Laoshi)
            </label>
            <label
              htmlFor="resource-pdf-input"
              className="flex items-center gap-3 border border-dashed border-bmos-border rounded-xl px-4 py-3 cursor-pointer hover:border-bmos-primary-light hover:bg-bmos-primary-soft/40 transition"
            >
              <span className="shrink-0 bg-bmos-primary text-white text-xs font-semibold rounded-lg px-3 py-1.5">
                Pilih PDF
              </span>
              <span className="text-sm text-bmos-text-light truncate">
                {pdfFile ? pdfFile.name : "Belum ada file dipilih"}
              </span>
            </label>
            <input
              id="resource-pdf-input"
              type="file"
              accept="application/pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-bmos-text mb-1">
              File Asli (opsional, PPT/dll -- cuma buat arsip Owner/Admin)
            </label>
            <label
              htmlFor="resource-original-input"
              className="flex items-center gap-3 border border-dashed border-bmos-border rounded-xl px-4 py-3 cursor-pointer hover:border-bmos-primary-light hover:bg-bmos-primary-soft/40 transition"
            >
              <span className="shrink-0 bg-gray-200 text-bmos-text text-xs font-semibold rounded-lg px-3 py-1.5">
                Pilih File Asli
              </span>
              <span className="text-sm text-bmos-text-light truncate">
                {originalFile ? originalFile.name : "Belum ada file dipilih"}
              </span>
            </label>
            <input
              id="resource-original-input"
              type="file"
              onChange={(e) => setOriginalFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading}
              className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
            >
              {uploading ? "Mengupload..." : "Upload"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl p-6">
        <h2 className="font-bold text-bmos-text text-lg mb-4">Bahan Ajar Terupload</h2>

        {resources.length === 0 ? (
          <p className="text-sm text-bmos-text-light text-center py-8">
            Belum ada bahan ajar.
          </p>
        ) : (
          <div className="space-y-3">
            {resources.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between border-b border-bmos-border last:border-0 pb-3 last:pb-0"
              >
                <div>
                  <p className="text-sm font-semibold text-bmos-text">{r.title}</p>
                  {r.uploaded_by_name && (
                    <p className="text-xs text-bmos-text-light">
                      diupload {r.uploaded_by_name}
                    </p>
                  )}
                  {r.description && (
                    <p className="text-sm text-bmos-text-light mt-1">{r.description}</p>
                  )}
                  <div className="flex gap-3 mt-1">
                    <a
                      href={r.pdf_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-bmos-primary hover:underline"
                    >
                      📄 {r.pdf_file_name || "PDF"}
                    </a>
                    {r.original_file_url && (
                      <a
                        href={r.original_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-bmos-text-light hover:underline"
                      >
                        📎 File asli
                      </a>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  disabled={deletingId === r.id}
                  className="text-xs text-red-600 hover:underline shrink-0 ml-3"
                >
                  {deletingId === r.id ? "..." : "Hapus"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
