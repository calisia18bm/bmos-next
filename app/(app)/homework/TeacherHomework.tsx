"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createHomework, deleteHomework } from "./actions";

type ClassOption = { id: string; name: string };

type HomeworkItem = {
  id: string;
  class_id: string;
  class_name: string | null;
  teacher_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
};

type Submission = {
  id: string;
  student_id: string;
  student_name: string | null;
  submission_type: string;
  answer_text: string | null;
  file_url: string | null;
  file_name: string | null;
  submitted_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  TEXT: "📝 Teks",
  AUDIO: "🎤 Suara",
  VIDEO: "🎥 Video",
  FILE: "📎 File",
};

export default function TeacherHomework({
  classes,
  homeworks,
  submissionsByHomework,
  classSizeById,
  isStaff,
  myTeacherId,
}: {
  classes: ClassOption[];
  homeworks: HomeworkItem[];
  submissionsByHomework: Record<string, Submission[]>;
  classSizeById: Record<string, number>;
  isStaff: boolean;
  myTeacherId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState(classes[0]?.id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!classId) {
      setError("Pilih kelas dulu.");
      return;
    }
    setLoading(true);
    setError("");
    const result = await createHomework({ classId, title, description, dueDate });
    setLoading(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    setTitle("");
    setDescription("");
    setDueDate("");
    setOpen(false);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Hapus PR ini? Jawaban murid yang udah masuk tetep kesimpen.")) return;
    setDeletingId(id);
    await deleteHomework(id);
    setDeletingId(null);
    router.refresh();
  }

  function canDelete(hw: HomeworkItem) {
    return isStaff || (myTeacherId && hw.teacher_id === myTeacherId);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="bg-bmos-primary text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition"
        >
          + Buat PR
        </button>
      </div>

      {homeworks.length === 0 ? (
        <div className="bg-white border border-bmos-border rounded-2xl p-10 text-center text-sm text-bmos-text-light">
          Belum ada PR.
        </div>
      ) : (
        <div className="space-y-3">
          {homeworks.map((hw) => {
            const submissions = submissionsByHomework[hw.id] ?? [];
            const classSize = classSizeById[hw.class_id] ?? 0;
            const expanded = expandedId === hw.id;
            return (
              <div key={hw.id} className="bg-white border border-bmos-border rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-bmos-text">{hw.title}</p>
                    <p className="text-xs text-bmos-text-light">
                      {hw.class_name}
                      {hw.due_date ? ` · Deadline ${hw.due_date}` : ""}
                    </p>
                    {hw.description && (
                      <p className="text-sm text-bmos-text-light mt-1">{hw.description}</p>
                    )}
                  </div>
                  {canDelete(hw) && (
                    <button
                      onClick={() => handleDelete(hw.id)}
                      disabled={deletingId === hw.id}
                      className="text-xs text-red-600 hover:underline shrink-0"
                    >
                      {deletingId === hw.id ? "..." : "Hapus"}
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setExpandedId(expanded ? null : hw.id)}
                  className="mt-2 text-xs font-semibold text-bmos-primary hover:underline"
                >
                  {expanded ? "Sembunyikan" : "Lihat"} Jawaban ({submissions.length}
                  {classSize ? `/${classSize}` : ""})
                </button>

                {expanded && (
                  <div className="mt-3 space-y-2 border-t border-bmos-border pt-3">
                    {submissions.length === 0 ? (
                      <p className="text-xs text-bmos-text-light">Belum ada yang submit.</p>
                    ) : (
                      submissions.map((s) => (
                        <div key={s.id} className="bg-gray-50 rounded-xl p-3 text-sm">
                          <p className="font-semibold text-bmos-text">
                            {s.student_name}{" "}
                            <span className="font-normal text-xs text-bmos-text-light">
                              {TYPE_LABEL[s.submission_type] || s.submission_type} ·{" "}
                              {new Date(s.submitted_at).toLocaleString("id-ID")}
                            </span>
                          </p>
                          {s.submission_type === "TEXT" ? (
                            <p className="text-bmos-text-light mt-1 whitespace-pre-line">
                              {s.answer_text}
                            </p>
                          ) : s.submission_type === "AUDIO" && s.file_url ? (
                            <audio controls src={s.file_url} className="mt-2 w-full" />
                          ) : s.submission_type === "VIDEO" && s.file_url ? (
                            <video controls src={s.file_url} className="mt-2 w-full max-h-64 rounded-lg" />
                          ) : (
                            s.file_url && (
                              <a
                                href={s.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold text-bmos-primary hover:underline mt-1 inline-block"
                              >
                                📎 {s.file_name || "Buka file"}
                              </a>
                            )
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-bmos-text mb-4">Buat PR Baru</h2>
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
                placeholder="Judul PR"
                required
                className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Instruksi PR"
                rows={3}
                className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
              />
              <div>
                <label className="block text-sm font-medium text-bmos-text mb-1">
                  Deadline (opsional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm text-bmos-text-light hover:text-bmos-text"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
                >
                  {loading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
