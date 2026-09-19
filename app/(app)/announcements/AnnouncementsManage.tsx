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
  valid_from: string | null;
  valid_until: string | null;
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
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await createAnnouncement({
      title,
      message,
      audience,
      validFrom: validFrom || undefined,
      validUntil: validUntil || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.message);
      return;
    }
    setTitle("");
    setMessage("");
    setAudience("ALL");
    setValidFrom("");
    setValidUntil("");
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
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-semibold text-bmos-text-light">
              Tampil mulai (opsional)
            </label>
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="w-full border border-bmos-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-bmos-text-light">
              Tampil sampai (opsional)
            </label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full border border-bmos-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
            />
          </div>
        </div>
        <p className="text-[11px] text-bmos-text-light">
          Kosongin kalau mau langsung tampil sekarang & ga pernah auto ilang. Kalau diisi, pengumuman otomatis hilang dari Home Murid/Laoshi setelah tanggal "sampai" lewat.
        </p>
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

      <p className="text-xs font-semibold text-bmos-text-light mb-2">
        Pengumuman yang udah diposting
      </p>
      {announcements.length === 0 ? (
        <p className="text-sm text-bmos-text-light text-center py-4">
          Belum ada pengumuman.
        </p>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => {
            const notOpenYet = !!a.valid_from && today < a.valid_from;
            const expired = !!a.valid_until && today > a.valid_until;
            return (
              <div
                key={a.id}
                className="bg-white border border-bmos-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-bmos-text">{a.title}</p>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-bmos-primary-soft text-bmos-primary">
                      {AUDIENCE_LABEL[a.audience] || a.audience}
                    </span>
                    {expired ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                        Udah berakhir
                      </span>
                    ) : notOpenYet ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-700">
                        Belum tampil
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
                        Lagi tampil
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    disabled={deletingId === a.id}
                    className="text-xs text-red-600 hover:underline shrink-0"
                  >
                    {deletingId === a.id ? "..." : "Hapus"}
                  </button>
                </div>
                <p className="text-sm text-bmos-text-light whitespace-pre-wrap">
                  {a.message}
                </p>
                {(a.valid_from || a.valid_until) && (
                  <p className="text-[11px] text-bmos-text-light mt-1">
                    📅 Tampil {a.valid_from || "sekarang"} s/d {a.valid_until || "seterusnya"}
                  </p>
                )}
                {a.created_by && (
                  <p className="text-xs text-bmos-text-light mt-1">
                    — {a.created_by}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
