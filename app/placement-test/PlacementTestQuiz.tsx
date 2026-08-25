"use client";

import { useState } from "react";
import { submitPlacementTest } from "./actions";

type Question = {
  id: string;
  question_text: string;
  options: string[];
};

export default function PlacementTestQuiz({ questions }: { questions: Question[] }) {
  const [step, setStep] = useState<"intro" | "quiz" | "result">("intro");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(
    new Array(questions.length).fill(null)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ score: number; total: number; levelSuggestion: string } | null>(
    null
  );

  function startQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama wajib diisi.");
      return;
    }
    setError("");
    setStep("quiz");
  }

  function selectAnswer(index: number) {
    setAnswers((prev) => prev.map((a, i) => (i === current ? index : a)));
  }

  async function handleNext() {
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
      return;
    }
    // Soal terakhir -- submit.
    setSubmitting(true);
    setError("");
    const res = await submitPlacementTest({ name, phone, email, answers });
    setSubmitting(false);
    if (!res.success || res.score === undefined) {
      setError(res.message);
      return;
    }
    setResult({
      score: res.score,
      total: res.total!,
      levelSuggestion: res.levelSuggestion!,
    });
    setStep("result");
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white border border-bmos-border rounded-2xl p-8 text-center text-sm text-bmos-text-light">
        Soal placement test belum tersedia. Hubungi BM Mandarin buat info
        lebih lanjut.
      </div>
    );
  }

  if (step === "intro") {
    return (
      <form
        onSubmit={startQuiz}
        className="bg-white border border-bmos-border rounded-2xl p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-bmos-text mb-1">Nama</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-bmos-text mb-1">
            No. WhatsApp (opsional)
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xxxxxxxxxx"
            className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-bmos-text mb-1">
            Email (opsional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
          />
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <button
          type="submit"
          className="w-full bg-bmos-primary text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition"
        >
          Mulai Test ({questions.length} soal)
        </button>
      </form>
    );
  }

  if (step === "result" && result) {
    return (
      <div className="bg-white border border-bmos-border rounded-2xl p-8 text-center">
        <p className="text-sm text-bmos-text-light mb-1">Hasil Placement Test</p>
        <p className="text-4xl font-extrabold text-bmos-primary mb-2">
          {result.score}/{result.total}
        </p>
        <p className="text-lg font-bold text-bmos-text mb-1">
          Saran Level: {result.levelSuggestion}
        </p>
        <p className="text-sm text-bmos-text-light mt-3">
          Terima kasih, {name}! Tim BM Mandarin bakal hubungi kamu buat
          info kelas yang sesuai.
        </p>
      </div>
    );
  }

  const q = questions[current];
  const selected = answers[current];

  return (
    <div className="bg-white border border-bmos-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-bmos-text-light">
          Soal {current + 1} dari {questions.length}
        </p>
        <p className="text-xs text-bmos-primary font-semibold">
          {questions.length - current - 1 > 0
            ? `Tinggal ${questions.length - current - 1} soal lagi`
            : "Soal terakhir"}
        </p>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-5">
        <div
          className="bg-bmos-primary h-1.5 rounded-full transition-all"
          style={{ width: `${((current + 1) / questions.length) * 100}%` }}
        />
      </div>

      <p className="text-base font-semibold text-bmos-text mb-4">{q.question_text}</p>

      <div className="space-y-2">
        {q.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => selectAnswer(i)}
            className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition ${
              selected === i
                ? "bg-bmos-primary text-white border-bmos-primary"
                : "bg-white text-bmos-text border-bmos-border hover:border-bmos-primary-light"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-4">{error}</p>
      )}

      <div className="flex justify-end mt-5">
        <button
          type="button"
          onClick={handleNext}
          disabled={selected === null || submitting}
          className="bg-bmos-primary text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-50"
        >
          {submitting
            ? "Mengirim..."
            : current < questions.length - 1
            ? "Lanjut"
            : "Selesai"}
        </button>
      </div>
    </div>
  );
}
