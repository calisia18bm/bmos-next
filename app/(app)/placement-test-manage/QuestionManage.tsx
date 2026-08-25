"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createQuestion, updateQuestion, deleteQuestion } from "./actions";

type Question = {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  order_index: number;
};

const EMPTY_OPTIONS = ["", "", "", ""];

function QuestionForm({
  initial,
  nextOrderIndex,
  onDone,
  onCancel,
}: {
  initial?: Question;
  nextOrderIndex: number;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [questionText, setQuestionText] = useState(initial?.question_text ?? "");
  const [options, setOptions] = useState<string[]>(
    initial?.options && initial.options.length > 0 ? [...initial.options] : EMPTY_OPTIONS
  );
  const [correctIndex, setCorrectIndex] = useState(initial?.correct_index ?? 0);
  const [orderIndex, setOrderIndex] = useState(String(initial?.order_index ?? nextOrderIndex));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }

  function addOption() {
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
    if (correctIndex === i) setCorrectIndex(0);
    else if (correctIndex > i) setCorrectIndex((c) => c - 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const cleanedOptions = options.filter((o) => o.trim().length > 0);
    const result = initial
      ? await updateQuestion(initial.id, {
          questionText,
          options: cleanedOptions,
          correctIndex,
          orderIndex: Number(orderIndex) || 0,
        })
      : await createQuestion({
          questionText,
          options: cleanedOptions,
          correctIndex,
          orderIndex: Number(orderIndex) || 0,
        });

    setLoading(false);
    if (!result.success) {
      setError(result.message);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={questionText}
        onChange={(e) => setQuestionText(e.target.value)}
        placeholder="Pertanyaan"
        required
        rows={2}
        className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
      />

      <div className="space-y-2">
        <p className="text-sm font-medium text-bmos-text">
          Pilihan Jawaban (klik radio buat tandain yang bener)
        </p>
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct"
              checked={correctIndex === i}
              onChange={() => setCorrectIndex(i)}
              className="shrink-0"
            />
            <input
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Pilihan ${i + 1}`}
              className="flex-1 border border-bmos-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="text-xs text-red-500 hover:underline shrink-0"
              >
                Hapus
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addOption}
          className="text-xs font-semibold text-bmos-primary hover:underline"
        >
          + Tambah pilihan
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-bmos-text mb-1">Urutan Soal</label>
        <input
          type="number"
          value={orderIndex}
          onChange={(e) => setOrderIndex(e.target.value)}
          className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
        />
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

export default function QuestionManage({ questions }: { questions: Question[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDone() {
    setAdding(false);
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Hapus soal ini?")) return;
    setDeletingId(id);
    await deleteQuestion(id);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-bmos-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-bmos-text text-lg">Soal Placement Test</h2>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="text-xs font-semibold text-bmos-primary bg-bmos-primary-soft rounded-lg px-3 py-1.5 hover:bg-bmos-primary-light hover:text-white transition"
            >
              + Tambah Soal
            </button>
          )}
        </div>

        {adding && (
          <div className="border border-bmos-border rounded-xl p-4 mb-4">
            <QuestionForm
              nextOrderIndex={questions.length}
              onDone={handleDone}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}

        {questions.length === 0 && !adding ? (
          <p className="text-sm text-bmos-text-light text-center py-8">
            Belum ada soal. Klik &quot;+ Tambah Soal&quot; buat mulai.
          </p>
        ) : (
          <div className="space-y-2">
            {questions.map((q) =>
              editingId === q.id ? (
                <div key={q.id} className="border border-bmos-border rounded-xl p-4">
                  <QuestionForm
                    initial={q}
                    nextOrderIndex={q.order_index}
                    onDone={handleDone}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div
                  key={q.id}
                  className="flex items-start justify-between border-b border-bmos-border last:border-0 pb-3 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-semibold text-bmos-text">{q.question_text}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {q.options.map((opt, i) => (
                        <span
                          key={i}
                          className={`text-[11px] px-2 py-0.5 rounded-full ${
                            i === q.correct_index
                              ? "bg-green-100 text-green-700 font-semibold"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-3">
                    <button
                      onClick={() => setEditingId(q.id)}
                      className="text-xs font-semibold text-bmos-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      disabled={deletingId === q.id}
                      className="text-xs text-red-600 hover:underline"
                    >
                      {deletingId === q.id ? "..." : "Hapus"}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
