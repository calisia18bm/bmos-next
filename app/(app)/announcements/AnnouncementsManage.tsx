"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAnnouncement, deleteAnnouncement } from "./actions";

type Announcement = {
  id: string;
  title: string;
  message: string;
  audience: string;
  created_by: string | null;
  created_at: string;
};

const AUDIENCE_OPTIONS = [
  { key: "ALL", label: "Semua (Laoshi & Murid)" },
  { key: "TEACHER", label: "Laoshi saja" },
  { key: "STUDENT", label: "Murid saja" },
];

const AUDIENCE_LABEL: Record<string, string> = {
  ALL: "Semua",
  TEACHER: "Laoshi",
  STUDENT: "Murid",
};

// Widget buat Owner/Admin posting pengumuman yang muncul di Home murid
// & laoshi -- bisa ditarget khusus (semua / laoshi aja / murid aja).
export default function AnnouncementsManage({
  announcements,
}: {
  announcements: Announcement[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<"ALL" | "TEACHER" | "STUDENT">("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await createAnnouncement({ title, message, audience });
    setLoading(false);
    if (!res.success) {
      setError(res.message);
      return;
    }
    setTitle("");
    setMessage("");
    setAudience("ALL");
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteAnnouncement(id);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="bg-white border border-bmos-border rounded-2xl p-6 mb-6">
      <h2 className="font-bold text-bmos-text text-lg mb-1">Pengumuman</h2>
      <p className="text-xs text-bmos-text-light mb-4">
        Muncul di Home murid & laoshi -- bisa ditarget khusus salah satu aja.
      </p>

      <form onSubmit={handleSubmit} className="space-y-2 mb-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Judul pengumuman"
          required
          className="w-full border border-bmos-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Isi pengumuman"
          required
          rows={2}
          className="w-full border border-bmos-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
        />
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as "ALL" | "TEACHER" | "STUDENT")}
          className="w-full border border-bmos-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
        >
          {AUDIENCE_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
          >
            {loading ? "Memposting..." : "Posting"}
          </button>
        </div>
      </form>

      {announcements.length === 0 ? (
        <p className="text-sm text-bmos-text-light text-center py-4">
          Belum ada pengumuman.
        </p>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between border-t border-bmos-border pt-2"
            >
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-bmos-text">{a.title}</p>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-bmos-primary-soft text-bmos-primary">
                    {AUDIENCE_LABEL[a.audience] || a.audience}
                  </span>
                </div>
                <p className="text-xs text-bmos-text-light">{a.message}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(a.id)}
                disabled={deletingId === a.id}
                className="text-xs text-red-600 hover:underline shrink-0 ml-3"
              >
                {deletingId === a.id ? "..." : "Hapus"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
