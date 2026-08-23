"use client";

import { useState } from "react";
import { submitClassCard, resubmitClassCard } from "./actions";
import { computeCommission, CommissionTier } from "@/lib/commission";
import { CLASS_DAYS, ClassCard, formatRupiah } from "@/lib/classCards";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  DRAFT: "bg-gray-100 text-gray-600",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Menunggu Approval",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  DRAFT: "Draft",
};

type FormState = {
  name: string;
  description: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  capacityMax: string;
  isPrivate: boolean;
  registrationStart: string;
  registrationEnd: string;
  price: string;
  sessionsCount: string;
  goalTags: string[];
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  dayOfWeek: "",
  startTime: "",
  endTime: "",
  capacityMax: "6",
  isPrivate: false,
  registrationStart: "",
  registrationEnd: "",
  price: "",
  sessionsCount: "4",
  goalTags: [],
};

function cardToForm(c: ClassCard): FormState {
  return {
    name: c.name,
    description: c.description || "",
    dayOfWeek: c.day_of_week || "",
    startTime: c.start_time?.slice(0, 5) || "",
    endTime: c.end_time?.slice(0, 5) || "",
    capacityMax: String(c.capacity_max),
    isPrivate: c.is_private,
    registrationStart: c.registration_start || "",
    registrationEnd: c.registration_end || "",
    price: c.price ? String(c.price) : "",
    sessionsCount: c.sessions_count ? String(c.sessions_count) : "",
    goalTags: c.goal_tags || [],
  };
}

export default function TeacherClassCards({
  cards,
  tiers,
  goalTags,
}: {
  cards: ClassCard[];
  tiers: CommissionTier[];
  goalTags: string[];
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const price = Number(form.price) || 0;
  const commission = price > 0 ? computeCommission(price, tiers) : null;

  function openNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setOpen(true);
  }

  function openEdit(card: ClassCard) {
    setEditingId(card.id);
    setForm(cardToForm(card));
    setError("");
    setOpen(true);
  }

  function toggleTag(key: string) {
    setForm((f) => ({
      ...f,
      goalTags: f.goalTags.includes(key)
        ? f.goalTags.filter((t) => t !== key)
        : [...f.goalTags, key],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = editingId
      ? await resubmitClassCard(editingId, form)
      : await submitClassCard(form);

    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setOpen(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={openNew}
          className="bg-bmos-primary text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition"
        >
          + Class Card
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="bg-white border border-bmos-border rounded-2xl p-10 text-center text-sm text-bmos-text-light">
          Belum ada kartu kelas yang kamu buat.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => {
            const cComm = c.price ? computeCommission(c.price, tiers) : null;
            return (
              <div
                key={c.id}
                className="bg-white border border-bmos-border rounded-2xl p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-bmos-text">{c.name}</p>
                  <span
                    className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full ${
                      STATUS_STYLE[c.approval_status]
                    }`}
                  >
                    {STATUS_LABEL[c.approval_status]}
                  </span>
                </div>

                <p className="text-xs text-bmos-text-light">
                  {c.day_of_week
                    ? `${c.day_of_week} · ${c.start_time?.slice(0, 5) || ""}-${
                        c.end_time?.slice(0, 5) || ""
                      }`
                    : "Jadwal belum diatur"}
                  {" · "}Kuota {c.capacity_max}
                  {c.is_private ? " · Privat" : ""}
                </p>

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

                {c.price ? (
                  <div className="text-xs bg-gray-50 rounded-xl p-2.5 mt-1">
                    <p className="text-bmos-text font-semibold">
                      {formatRupiah(c.price)}{" "}
                      <span className="font-normal text-bmos-text-light">
                        / {c.sessions_count ?? "-"} sesi
                      </span>
                    </p>
                    {cComm && (
                      <>
                        <p className="text-bmos-text-light">
                          Potong {cComm.pct}% untuk BM (Rp{" "}
                          {cComm.cut.toLocaleString("id-ID")})
                        </p>
                        <p className="text-green-700 font-semibold">
                          Kamu terima: {formatRupiah(cComm.net)}
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-bmos-text-light italic">
                    Harga belum diisi
                  </p>
                )}

                {c.approval_status === "REJECTED" && c.rejection_note && (
                  <div className="text-xs bg-red-50 border border-red-100 rounded-xl p-2.5 text-red-700">
                    <p className="font-semibold mb-0.5">Alasan ditolak:</p>
                    <p>{c.rejection_note}</p>
                  </div>
                )}

                {(c.approval_status === "REJECTED" ||
                  c.approval_status === "PENDING") && (
                  <button
                    onClick={() => openEdit(c)}
                    className="mt-1 text-xs font-semibold text-bmos-primary hover:underline self-start"
                  >
                    ✏️ Edit & submit ulang
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-bmos-text mb-4">
              {editingId ? "Edit Class Card" : "Class Card Baru"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-bmos-text mb-1">
                  Nama Kelas
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Kelas Percakapan Sore"
                  className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-bmos-text mb-1">
                  Deskripsi
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={2}
                  placeholder="Ceritain singkat kelas ini buat murid"
                  className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-bmos-text mb-1">
                    Hari
                  </label>
                  <select
                    value={form.dayOfWeek}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dayOfWeek: e.target.value }))
                    }
                    className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                  >
                    <option value="">Pilih hari</option>
                    {CLASS_DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-bmos-text mb-1">
                    Kuota Murid
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.capacityMax}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, capacityMax: e.target.value }))
                    }
                    className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-bmos-text mb-1">
                    Jam Mulai
                  </label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, startTime: e.target.value }))
                    }
                    className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-bmos-text mb-1">
                    Jam Selesai
                  </label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endTime: e.target.value }))
                    }
                    className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-bmos-text mb-1">
                  Tipe Kelas
                </label>
                <select
                  value={form.isPrivate ? "private" : "umum"}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      isPrivate: e.target.value === "private",
                    }))
                  }
                  className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                >
                  <option value="umum">Umum (ditampilin di daftar pilihan Murid)</option>
                  <option value="private">Private (ga ditampilin, daftarnya lewat Admin/Laoshi langsung)</option>
                </select>
              </div>

              <div>
                <p className="text-sm font-medium text-bmos-text mb-1">
                  Periode Pendaftaran
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={form.registrationStart}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, registrationStart: e.target.value }))
                    }
                    className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                  />
                  <input
                    type="date"
                    value={form.registrationEnd}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, registrationEnd: e.target.value }))
                    }
                    className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-bmos-text mb-1">
                    Harga per Paket (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                    placeholder="200000"
                    className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-bmos-text mb-1">
                    Jumlah Sesi / Paket
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.sessionsCount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sessionsCount: e.target.value }))
                    }
                    className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                  />
                </div>
              </div>

              {commission && (
                <div className="text-xs bg-bmos-primary-soft rounded-xl p-3">
                  <p className="text-bmos-text">
                    {formatRupiah(price)}
                  </p>
                  <p className="text-bmos-text-light">
                    Potong {commission.pct}% untuk BM (Rp{" "}
                    {commission.cut.toLocaleString("id-ID")})
                  </p>
                  <p className="text-green-700 font-semibold">
                    Kamu terima: {formatRupiah(commission.net)}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-bmos-text mb-1">
                  Tujuan Belajar
                </p>
                <div className="flex flex-wrap gap-2">
                  {goalTags.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition ${
                        form.goalTags.includes(tag)
                          ? "bg-bmos-primary text-white border-bmos-primary"
                          : "bg-white text-bmos-text-light border-bmos-border hover:border-bmos-primary-light"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                  {goalTags.length === 0 && (
                    <p className="text-xs text-bmos-text-light">
                      Owner belum atur daftar tujuan belajar.
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
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
                  {loading ? "Mengirim..." : "Submit ke Owner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
