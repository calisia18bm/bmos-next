"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createMaterial, deleteMaterial } from "./actions";

type ClassOption = { id: string; name: string };

type Material = {
  id: string;
  class_id: string;
  class_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  created_at: string;
};

// Dipakai buat Laoshi (upload ke kelas dia sendiri) & Owner/Admin (upload
// ke kelas mana aja, bisa hapus punya siapapun). Bedanya cuma dari props
// `classes` (Laoshi cuma dikasih kelas dia) dan `isStaff` (ngatur siapa
// yang boleh hapus punya orang lain).
export default function MaterialsManage({
  classes,
  materials,
  isStaff,
  myTeacherId,
}: {
  classes: ClassOption[];
  materials: Material[];
  isStaff: boolean;
  myTeacherId: string | null;
}) {
  const router = useRouter();
  const [classId, setClassId] = useState(classes[0]?.id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!classId) {
      setError("Pilih kelas dulu.");
      return;
    }
    if (!file) {
      setError("Pilih file materinya dulu.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${classId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("materials")
        .upload(path, file);

      if (uploadError) {
        setError(`Gagal upload file: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("materials")
        .getPublicUrl(path);

      const res = await createMaterial({
        classId,
        title,
        description,
        fileUrl: publicUrlData.publicUrl,
        fileName: file.name,
        filePath: path,
      });

      if (!res.success) {
        setError(res.message);
        setUploading(false);
        return;
      }

      setTitle("");
      setDescription("");
      setFile(null);
      const fileInput = document.getElementById(
        "material-file-input"
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteMaterial(id);
    setDeletingId(null);
    router.refresh();
  }

  function canDelete(m: Material) {
    return isStaff || (myTeacherId && m.teacher_id === myTeacherId);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-bmos-border rounded-2xl p-6">
        <h2 className="font-bold text-bmos-text text-lg mb-1">
          Upload Materi Baru
        </h2>
        <p className="text-xs text-bmos-text-light mb-4">
          File akan langsung bisa dilihat/didownload murid di kelas yang
          dipilih.
        </p>

        {classes.length === 0 ? (
          <p className="text-sm text-bmos-text-light">
            Belum ada kelas yang bisa diupload materinya.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
              <label className="block text-sm font-medium text-bmos-text mb-1">
                File Materi
              </label>
              <label
                htmlFor="material-file-input"
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
                id="material-file-input"
                type="file"
                required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
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
        )}
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl p-6">
        <h2 className="font-bold text-bmos-text text-lg mb-4">
          Materi Terupload
        </h2>

        {materials.length === 0 ? (
          <p className="text-sm text-bmos-text-light text-center py-8">
            Belum ada materi.
          </p>
        ) : (
          <div className="space-y-3">
            {materials.map((m) => (
              <div
                key={m.id}
                className="flex items-start justify-between border-b border-bmos-border last:border-0 pb-3 last:pb-0"
              >
                <div>
                  <p className="text-sm font-semibold text-bmos-text">
                    {m.title}
                  </p>
                  <p className="text-xs text-bmos-text-light">
                    {m.class_name}
                    {isStaff && m.teacher_name ? ` · ${m.teacher_name}` : ""}
                  </p>
                  {m.description && (
                    <p className="text-sm text-bmos-text-light mt-1">
                      {m.description}
                    </p>
                  )}
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-bmos-primary hover:underline mt-1 inline-block"
                  >
                    📎 {m.file_name || "Buka file"}
                  </a>
                </div>
                {canDelete(m) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(m.id)}
                    disabled={deletingId === m.id}
                    className="text-xs text-red-600 hover:underline shrink-0 ml-3"
                  >
                    {deletingId === m.id ? "..." : "Hapus"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
