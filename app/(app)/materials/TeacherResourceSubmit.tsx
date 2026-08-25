"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitTeacherResourceDraft } from "./actions";

type Submission = {
  id: string;
  title: string;
  description: string | null;
  submitted_file_url: string;
  submitted_file_name: string | null;
  status: string;
  rejection_note: string | null;
  created_at: string;
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu Review",
  APPROVED: "Disetujui & Dipublish",
  REJECTED: "Ditolak",
};

// Laoshi submit draft materi mereka sendiri (file asli, misal PPT) buat
// direview Admin/Owner dulu. Kalau di-approve, Admin/Owner upload versi
// PDF final dan materinya otomatis kepublish jadi bahan ajar buat SEMUA
// Laoshi (bukan cuma yang submit) -- liat di bagian "Bahan Ajar dari
// Admin/Owner" di atas. Laoshi ga pernah bisa edit lagi setelah submit,
// cuma bisa lihat status & catatan penolakan kalau ditolak.
export default function TeacherResourceSubmit({
  submissions,
  disabled,
}: {
  submissions: Submission[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("Pilih file draft materi kamu dulu (PPT/Word/PDF/dll).");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `submit_${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("teacher-resources")
        .upload(path, file);
      if (uploadError) throw new Error(uploadError.message);
      const { data } = supabase.storage.from("teacher-resources").getPublicUrl(path);

      const res = await submitTeacherResourceDraft({
        title,
        description,
        fileUrl: data.publicUrl,
        fileName: file.name,
        filePath: path,
      });

      if (!res.success) {
        setError(res.message);
        return;
      }

      setTitle("");
      setDescription("");
      setFile(null);
      const input = document.getElementById("submit-resource-input") as HTMLInputElement | null;
      if (input) input.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal upload file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white border border-bmos-border rounded-2xl p-6">
      <h2 className="font-bold text-bmos-text text-lg mb-1">Submit Materi Kamu</h2>
      <p className="text-xs text-bmos-text-light mb-4">
        Upload draft materi kamu (PPT/Word/dll) buat dicek & diedit dulu
        sama Admin/Owner. Kalau disetujui, materinya bakal dipublish jadi
        PDF dan bisa dipakai semua Laoshi di halaman &quot;Bahan Ajar dari
        Admin/Owner&quot; di atas.
      </p>

      {disabled ? (
        <p className="text-xs text-bmos-text-light italic mb-4">
          (Form submit dimatiin di mode preview.)
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 mb-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Judul materi"
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
            <label
              htmlFor="submit-resource-input"
              className="flex items-center gap-3 border border-dashed border-bmos-border rounded-xl px-4 py-3 cursor-pointer hover:border-bmos-primary-light hover:bg-bmos-primary-soft/40 transition"
            >
              <span className="shrink-0 bg-bmos-primary text-white text-xs font-semibold rounded-lg px-3 py-1.5">
                Pilih File
              </span>
              <span className="text-sm text-bmos-text-light truncate">
                {file ? file.name : "Belum ada file dipilih"}
              </span>
            </label>
            <input
              id="submit-resource-input"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
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
              {uploading ? "Mengupload..." : "Submit ke Admin/Owner"}
            </button>
          </div>
        </form>
      )}

      <h3 className="text-sm font-bold text-bmos-text uppercase tracking-wide mb-2">
        Materi yang Sudah Kamu Submit
      </h3>
      {submissions.length === 0 ? (
        <p className="text-sm text-bmos-text-light text-center py-6">
          Belum pernah submit materi.
        </p>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div
              key={s.id}
              className="border-b border-bmos-border last:border-0 pb-3 last:pb-0"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-bmos-text">{s.title}</p>
                <span
                  className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full ${STATUS_STYLE[s.status]}`}
                >
                  {STATUS_LABEL[s.status]}
                </span>
              </div>
              {s.description && (
                <p className="text-sm text-bmos-text-light mt-1">{s.description}</p>
              )}
              <a
                href={s.submitted_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-bmos-text-light hover:underline mt-1 inline-block"
              >
                📎 File draft: {s.submitted_file_name || "buka file"}
              </a>
              {s.status === "REJECTED" && s.rejection_note && (
                <div className="text-xs bg-red-50 border border-red-100 rounded-xl p-2.5 text-red-700 mt-1.5">
                  <p className="font-semibold mb-0.5">Catatan dari Admin/Owner:</p>
                  <p>{s.rejection_note}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
