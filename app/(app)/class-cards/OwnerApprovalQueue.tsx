"use client";

import { useState } from "react";
import {
  approveClassCard,
  rejectClassCard,
  saveCommissionTiers,
  saveGoalTags,
} from "./actions";
import { computeCommission, CommissionTier } from "@/lib/commission";
import { ClassCard, formatRupiah } from "@/lib/classCards";

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

export default function OwnerApprovalQueue({
  cards,
  tiers,
  goalTags,
  canApprove,
}: {
  cards: ClassCard[];
  tiers: CommissionTier[];
  goalTags: string[];
  canApprove: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localTiers, setLocalTiers] = useState<CommissionTier[]>(tiers);
  const [savingTiers, setSavingTiers] = useState(false);
  const [tiersMsg, setTiersMsg] = useState("");
  const [localGoalTags, setLocalGoalTags] = useState<string[]>(goalTags);
  const [savingGoalTags, setSavingGoalTags] = useState(false);
  const [goalTagsMsg, setGoalTagsMsg] = useState("");
  const [newGoalTag, setNewGoalTag] = useState("");

  const pending = cards.filter((c) => c.approval_status === "PENDING");
  const others = cards.filter((c) => c.approval_status !== "PENDING");

  async function handleApprove(id: string) {
    if (!window.confirm("Approve kartu kelas ini? Bakal langsung tayang buat Murid."))
      return;
    setBusyId(id);
    await approveClassCard(id);
    setBusyId(null);
  }

  async function handleReject(id: string) {
    const note = window.prompt("Alasan reject (wajib diisi, bakal dilihat Laoshi):");
    if (note === null) return;
    if (!note.trim()) {
      alert("Alasan reject wajib diisi.");
      return;
    }
    setBusyId(id);
    await rejectClassCard(id, note);
    setBusyId(null);
  }

  function updateTier(index: number, field: "maxPrice" | "pct", value: string) {
    setLocalTiers((prev) =>
      prev.map((t, i) =>
        i === index
          ? {
              ...t,
              [field]:
                field === "maxPrice"
                  ? value === ""
                    ? null
                    : Number(value)
                  : Number(value),
            }
          : t
      )
    );
  }

  function addTier() {
    setLocalTiers((prev) => [...prev, { maxPrice: null, pct: 10 }]);
  }

  function removeTier(index: number) {
    setLocalTiers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveTiers() {
    setSavingTiers(true);
    setTiersMsg("");
    const result = await saveCommissionTiers(localTiers);
    setSavingTiers(false);
    setTiersMsg(result.message);
  }

  function addGoalTag() {
    const tag = newGoalTag.trim();
    if (!tag || localGoalTags.includes(tag)) {
      setNewGoalTag("");
      return;
    }
    setLocalGoalTags((prev) => [...prev, tag]);
    setNewGoalTag("");
  }

  function removeGoalTag(tag: string) {
    setLocalGoalTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleSaveGoalTags() {
    setSavingGoalTags(true);
    setGoalTagsMsg("");
    const result = await saveGoalTags(localGoalTags);
    setSavingGoalTags(false);
    setGoalTagsMsg(result.message);
  }

  function renderCard(c: ClassCard) {
    const comm = c.price ? computeCommission(c.price, tiers) : null;
    return (
      <div
        key={c.id}
        className="bg-white border border-bmos-border rounded-2xl p-4 flex flex-col gap-2"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-bmos-text">{c.name}</p>
            <p className="text-xs text-bmos-text-light">
              👩‍🏫 {c.teacher_name || "-"} · {c.class_code}
            </p>
          </div>
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

        <p className="text-xs text-bmos-text-light">
          Pendaftaran: {c.registration_start || "-"} s/d{" "}
          {c.registration_end || "-"}
        </p>

        {c.price ? (
          <div className="text-xs bg-gray-50 rounded-xl p-2.5">
            <p className="text-bmos-text font-semibold">
              {formatRupiah(c.price)}{" "}
              <span className="font-normal text-bmos-text-light">
                / {c.sessions_count ?? "-"} sesi
              </span>
            </p>
            {comm && (
              <>
                <p className="text-bmos-text-light">
                  Potong {comm.pct}% untuk BM (Rp {comm.cut.toLocaleString("id-ID")})
                </p>
                <p className="text-green-700 font-semibold">
                  Laoshi terima: {formatRupiah(comm.net)}
                </p>
              </>
            )}
          </div>
        ) : (
          <p className="text-xs text-bmos-text-light italic">Harga belum diisi</p>
        )}

        {c.ai_note && (
          <div className="text-xs bg-blue-50 border border-blue-100 rounded-xl p-2.5 text-blue-800 whitespace-pre-line">
            <p className="font-semibold mb-0.5">💡 Catatan otomatis:</p>
            {c.ai_note}
          </div>
        )}

        {c.approval_status === "REJECTED" && c.rejection_note && (
          <div className="text-xs bg-red-50 border border-red-100 rounded-xl p-2.5 text-red-700">
            <p className="font-semibold mb-0.5">Alasan ditolak:</p>
            <p>{c.rejection_note}</p>
          </div>
        )}

        {c.approval_status === "PENDING" && canApprove && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handleApprove(c.id)}
              disabled={busyId === c.id}
              className="flex-1 bg-bmos-primary text-white rounded-xl py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
            >
              {busyId === c.id ? "..." : "✓ Approve"}
            </button>
            <button
              onClick={() => handleReject(c.id)}
              disabled={busyId === c.id}
              className="flex-1 bg-red-50 text-red-600 rounded-xl py-2 text-sm font-semibold hover:bg-red-100 transition disabled:opacity-60"
            >
              Tolak
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-bmos-text uppercase tracking-wide mb-3">
            Menunggu Approval ({pending.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pending.map(renderCard)}
          </div>
        </div>
      )}

      {canApprove && (
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <h2 className="text-sm font-bold text-bmos-text uppercase tracking-wide mb-1">
            Pengaturan Potongan Komisi
          </h2>
          <p className="text-xs text-bmos-text-light mb-3">
            Makin murah harga per paket, tier di bawah ini nentuin berapa %
            yang dipotong buat BM. Baris dengan &quot;Harga maksimal&quot;
            kosong berarti berlaku buat harga di atas semua tier lain.
          </p>
          <div className="space-y-2">
            {localTiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-bmos-text-light w-14 shrink-0">
                  Sampai
                </span>
                <input
                  type="number"
                  placeholder="tanpa batas"
                  value={t.maxPrice ?? ""}
                  onChange={(e) => updateTier(i, "maxPrice", e.target.value)}
                  className="flex-1 border border-bmos-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                />
                <input
                  type="number"
                  value={t.pct}
                  onChange={(e) => updateTier(i, "pct", e.target.value)}
                  className="w-20 border border-bmos-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                />
                <span className="text-xs text-bmos-text-light">%</span>
                <button
                  onClick={() => removeTier(i)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={addTier}
              className="text-xs font-semibold text-bmos-primary hover:underline"
            >
              + Tambah tier
            </button>
            <button
              onClick={handleSaveTiers}
              disabled={savingTiers}
              className="ml-auto bg-bmos-primary text-white rounded-xl px-4 py-2 text-xs font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
            >
              {savingTiers ? "Menyimpan..." : "Simpan Pengaturan"}
            </button>
          </div>
          {tiersMsg && (
            <p className="text-xs text-bmos-text-light mt-2">{tiersMsg}</p>
          )}
        </div>
      )}

      {canApprove && (
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <h2 className="text-sm font-bold text-bmos-text uppercase tracking-wide mb-1">
            Pengaturan Tujuan Belajar
          </h2>
          <p className="text-xs text-bmos-text-light mb-3">
            Daftar badge tujuan belajar (HSK, China Buddy, dll) yang bisa
            dipilih Laoshi pas bikin kartu kelas.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {localGoalTags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1.5 text-xs font-semibold bg-bmos-primary-soft text-bmos-primary px-2.5 py-1.5 rounded-full"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeGoalTag(tag)}
                  className="text-bmos-primary hover:text-red-600"
                  title="Hapus"
                >
                  ×
                </button>
              </span>
            ))}
            {localGoalTags.length === 0 && (
              <p className="text-xs text-bmos-text-light">
                Belum ada tujuan belajar.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={newGoalTag}
              onChange={(e) => setNewGoalTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addGoalTag();
                }
              }}
              placeholder="Contoh: HSK 7, Anak SD, dll"
              className="flex-1 border border-bmos-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
            />
            <button
              type="button"
              onClick={addGoalTag}
              className="text-xs font-semibold text-bmos-primary bg-bmos-primary-soft rounded-xl px-3 py-2 hover:bg-bmos-primary-light hover:text-white transition"
            >
              + Tambah
            </button>
            <button
              onClick={handleSaveGoalTags}
              disabled={savingGoalTags}
              className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-xs font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
            >
              {savingGoalTags ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
          {goalTagsMsg && (
            <p className="text-xs text-bmos-text-light mt-2">{goalTagsMsg}</p>
          )}
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold text-bmos-text uppercase tracking-wide mb-3">
          Semua Kartu Kelas
        </h2>
        {others.length === 0 && pending.length === 0 ? (
          <div className="bg-white border border-bmos-border rounded-2xl p-10 text-center text-sm text-bmos-text-light">
            Belum ada kartu kelas dari Laoshi.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {others.map(renderCard)}
          </div>
        )}
      </div>
    </div>
  );
}
