"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addVocabWord, updateVocabWord, deleteVocabWord } from "../challenge/actions";

type Word = {
  id: string;
  hanzi: string;
  pinyin: string;
  arti: string;
  audio_url: string | null;
  order_index: number;
  active: boolean;
};

function WordForm({
  level,
  initial,
  nextOrderIndex,
  onDone,
  onCancel,
}: {
  level: "DASAR" | "MENENGAH";
  initial?: Word;
  nextOrderIndex: number;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [hanzi, setHanzi] = useState(initial?.hanzi ?? "");
  const [pinyin, setPinyin] = useState(initial?.pinyin ?? "");
  const [arti, setArti] = useState(initial?.arti ?? "");
  const [audioUrl, setAudioUrl] = useState(initial?.audio_url ?? "");
  const [orderIndex, setOrderIndex] = useState(String(initial?.order_index ?? nextOrderIndex));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = initial
      ? await updateVocabWord(initial.id, {
          hanzi,
          pinyin,
          arti,
          audioUrl,
          orderIndex: Number(orderIndex) || 0,
        })
      : await addVocabWord({
          level,
          hanzi,
          pinyin,
          arti,
          audioUrl,
          orderIndex: Number(orderIndex) || 0,
        });
    setLoading(false);
    if (!result.success) {
      setError(result.message || "Gagal menyimpan.");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-bmos-text mb-1">Hanzi</label>
          <input
            value={hanzi}
            onChange={(e) => setHanzi(e.target.value)}
            required
            className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-bmos-text mb-1">Pinyin</label>
          <input
            value={pinyin}
            onChange={(e) => setPinyin(e.target.value)}
            required
            className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-bmos-text mb-1">Arti (Bahasa Indonesia)</label>
        <input
          value={arti}
          onChange={(e) => setArti(e.target.value)}
          required
          className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-bmos-text mb-1">
            Audio URL (opsional)
          </label>
          <input
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="https://..."
            className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-bmos-text mb-1">Urutan</label>
          <input
            type="number"
            value={orderIndex}
            onChange={(e) => setOrderIndex(e.target.value)}
            className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-bmos-text-light hover:text-bmos-text"
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
        >
          {loading ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </form>
  );
}

export default function VocabManage({
  dasarWords,
  menengahWords,
}: {
  dasarWords: Word[];
  menengahWords: Word[];
}) {
  const router = useRouter();
  const [level, setLevel] = useState<"DASAR" | "MENENGAH">("DASAR");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const words = level === "DASAR" ? dasarWords : menengahWords;

  function handleDone() {
    setAdding(false);
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Hapus kosakata ini?")) return;
    setDeletingId(id);
    await deleteVocabWord(id);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="bg-white border border-bmos-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2">
          {(["DASAR", "MENENGAH"] as const).map((lv) => (
            <button
              key={lv}
              onClick={() => {
                setLevel(lv);
                setAdding(false);
                setEditingId(null);
              }}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                level === lv
                  ? "bg-bmos-primary text-white border-bmos-primary"
                  : "bg-white text-bmos-text-light border-bmos-border"
              }`}
            >
              {lv} ({lv === "DASAR" ? dasarWords.length : menengahWords.length}/300)
            </button>
          ))}
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs font-semibold text-bmos-primary bg-bmos-primary-soft rounded-lg px-3 py-1.5 hover:bg-bmos-primary-light hover:text-white transition"
          >
            + Tambah Kosakata
          </button>
        )}
      </div>

      <p className="text-xs text-bmos-text-light mb-4">
        Tiap 10 kosakata (berurutan sesuai &quot;Urutan&quot;) jadi 1 hari
        challenge. Perlu 300 kosakata per level buat 30 hari penuh -- boleh
        nyicil nambah pelan-pelan.
      </p>

      {adding && (
        <div className="border border-bmos-border rounded-xl p-4 mb-4">
          <WordForm level={level} nextOrderIndex={words.length} onDone={handleDone} onCancel={() => setAdding(false)} />
        </div>
      )}

      {words.length === 0 && !adding ? (
        <p className="text-sm text-bmos-text-light text-center py-8">
          Belum ada kosakata level {level}. Klik &quot;+ Tambah Kosakata&quot; buat mulai.
        </p>
      ) : (
        <div className="space-y-2">
          {words.map((w, i) =>
            editingId === w.id ? (
              <div key={w.id} className="border border-bmos-border rounded-xl p-4">
                <WordForm level={level} initial={w} nextOrderIndex={w.order_index} onDone={handleDone} onCancel={() => setEditingId(null)} />
              </div>
            ) : (
              <div
                key={w.id}
                className="flex items-center justify-between border-b border-bmos-border last:border-0 pb-3 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold text-bmos-text-light w-16 shrink-0">
                    Hari {Math.floor(i / 10) + 1} · #{w.order_index}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-bmos-text">
                      {w.hanzi} <span className="font-normal text-bmos-text-light">({w.pinyin})</span>
                    </p>
                    <p className="text-xs text-bmos-text-light">{w.arti}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <button onClick={() => setEditingId(w.id)} className="text-xs font-semibold text-bmos-primary hover:underline">
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(w.id)}
                    disabled={deletingId === w.id}
                    className="text-xs text-red-600 hover:underline"
                  >
                    {deletingId === w.id ? "..." : "Hapus"}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
