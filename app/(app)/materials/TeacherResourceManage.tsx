"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createTeacherResource, deleteTeacherResource } from "./actions";

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

// Owner/Admin upload bahan ajar buat Laoshi -- WAJIB upload versi PDF
// (yang bakal dilihat Laoshi), file asli (PPT/dll) OPSIONAL, cuma buat
// arsip Owner/Admin sendiri, Laoshi ga pernah dikasih akses ke file asli.
export default function TeacherResourceManage({ resources }: { resources: Resource[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
