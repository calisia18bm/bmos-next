"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitDayTest } from "./actions";

type Word = {
  id: string;
  hanzi: string;
  pinyin: string;
  arti: string;
  audio_url: string | null;
};

type QuestionFormat = "HANZI_TO_ARTI" | "ARTI_TO_HANZI" | "AUDIO_TO_ARTI";

type Question = {
  word: Word;
  format: QuestionFormat;
  choices: string[]; // 4 pilihan (teks arti ATAU teks hanzi tergantung format)
  correctChoice: string;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions(words: Word[]): Question[] {
  return shuffle(words).map((word) => {
    const others = words.filter((w) => w.id !== word.id);
    const distractorPool = shuffle(others).slice(0, 3);

    const formats: QuestionFormat[] = word.audio_url
      ? ["HANZI_TO_ARTI", "ARTI_TO_HANZI", "AUDIO_TO_ARTI"]
      : ["HANZI_TO_ARTI", "ARTI_TO_HANZI"];
    const format = formats[Math.floor(Math.random() * formats.length)];

    if (format === "ARTI_TO_HANZI") {
      const choices = shuffle([word.hanzi, ...distractorPool.map((d) => d.hanzi)]);
      return { word, format, choices, correctChoice: word.hanzi };
    }
    // HANZI_TO_ARTI & AUDIO_TO_ARTI sama-sama minta pilih arti
    const choices = shuffle([word.arti, ...distractorPool.map((d) => d.arti)]);
    return { word, format, choices, correctChoice: word.arti };
  });
}

function FlashcardGrid({
  words,
  opened,
  onOpen,
}: {
  words: Word[];
  opened: Set<string>;
  onOpen: (id: string) => void;
}) {
  const [flipped, setFlipped] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {words.map((w) => {
        const isFlipped = flipped === w.id;
        const isOpened = opened.has(w.id);
        return (
          <button
            key={w.id}
            onClick={() => {
              setFlipped(isFlipped ? null : w.id);
              if (!isOpened) onOpen(w.id);
            }}
            className={`relative aspect-square rounded-2xl border p-3 flex flex-col items-center justify-center text-center transition ${
              isFlipped
                ? "bg-bmos-primary text-white border-bmos-primary"
                : "bg-white border-bmos-border hover:border-bmos-primary-light"
            }`}
          >
            {isOpened && (
              <span className="absolute top-1.5 right-1.5 text-[10px]">✅</span>
            )}
            {isFlipped ? (
              <div>
                <p className="text-sm font-bold">{w.pinyin}</p>
                <p className="text-xs mt-1">{w.arti}</p>
                {w.audio_url && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      new Audio(w.audio_url!).play().catch(() => {});
                    }}
                    className="inline-block mt-2 text-xs bg-white/20 rounded-full px-2 py-1"
                  >
                    🔊 Dengar
                  </span>
                )}
              </div>
            ) : (
              <p className="text-3xl font-bold">{w.hanzi}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function QuizSection({
  words,
  dayNumber,
  isMakeup,
  onPassed,
}: {
  words: Word[];
  dayNumber: number;
  isMakeup: boolean;
  onPassed: () => void;
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>(() => buildQuestions(words));
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ score: number; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function selectAnswer(qIndex: number, choice: string) {
    if (result) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: choice }));
  }

  async function handleSubmit() {
    const score = questions.reduce(
      (sum, q, i) => sum + (answers[i] === q.correctChoice ? 1 : 0),
      0
    );
    setLoading(true);
    const res = await submitDayTest({
      dayNumber,
      score,
      totalQuestions: questions.length,
    });
    setLoading(false);
    setResult({ score, message: res.message });
    if (res.passed) {
      onPassed();
      router.refresh();
    }
  }

  function tryAgain() {
    setQuestions(buildQuestions(words));
    setAnswers({});
    setResult(null);
  }

  const allAnswered = questions.every((_, i) => answers[i] !== undefined);

  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <div key={q.word.id} className="bg-white border border-bmos-border rounded-2xl p-4">
          <p className="text-xs text-bmos-text-light mb-2">
            Soal {i + 1} dari {questions.length}
          </p>
          {q.format === "HANZI_TO_ARTI" && (
            <p className="text-3xl font-bold text-bmos-text mb-3">{q.word.hanzi}</p>
          )}
          {q.format === "ARTI_TO_HANZI" && (
            <p className="text-lg font-semibold text-bmos-text mb-3">
              Hanzi buat &quot;{q.word.arti}&quot; ?
            </p>
          )}
          {q.format === "AUDIO_TO_ARTI" && (
            <button
              type="button"
              onClick={() => new Audio(q.word.audio_url!).play().catch(() => {})}
              className="mb-3 bg-bmos-primary-soft text-bmos-primary rounded-xl px-4 py-2 text-sm font-semibold"
            >
              🔊 Putar Audio
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            {q.choices.map((choice) => {
              const isSelected = answers[i] === choice;
              const showCorrectness = !!result;
              const isCorrectChoice = choice === q.correctChoice;
              let cls = "bg-white border-bmos-border hover:border-bmos-primary-light";
              if (isSelected && !showCorrectness) cls = "bg-bmos-primary-soft border-bmos-primary";
              if (showCorrectness && isCorrectChoice) cls = "bg-green-100 border-green-400";
              if (showCorrectness && isSelected && !isCorrectChoice) cls = "bg-red-100 border-red-400";
              return (
                <button
                  key={choice}
                  disabled={!!result}
                  onClick={() => selectAnswer(i, choice)}
                  className={`text-sm font-medium rounded-xl border px-3 py-2.5 transition ${cls}`}
                >
                  {choice}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {result ? (
        <div
          className={`rounded-2xl p-4 text-sm font-semibold ${
            result.score === questions.length
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-yellow-50 text-yellow-800 border border-yellow-200"
          }`}
        >
          <p>
            Skor: {result.score}/{questions.length} -- {result.message}
          </p>
          {result.score !== questions.length && (
            <button
              onClick={tryAgain}
              className="mt-2 bg-bmos-primary text-white rounded-xl px-4 py-2 text-xs font-semibold hover:bg-bmos-primary-light"
            >
              Coba Lagi
            </button>
          )}
        </div>
      ) : (
        <button
          disabled={!allAnswered || loading}
          onClick={handleSubmit}
          className="w-full bg-bmos-primary text-white rounded-xl px-4 py-3 text-sm font-bold hover:bg-bmos-primary-light transition disabled:opacity-50"
        >
          {loading ? "Mengirim..." : isMakeup ? "Submit Susulan" : "Submit Test"}
        </button>
      )}
    </div>
  );
}

export default function ChallengeStudent({
  studentName,
  level,
  progress,
  alreadyDoneToday,
  words,
  frozenDay,
  frozenDayDeadline,
  frozenWords,
}: {
  studentName: string;
  level: string;
  progress: { current_day: number; freeze_available: boolean };
  alreadyDoneToday: boolean;
  words: Word[];
  frozenDay: number | null;
  frozenDayDeadline: string | null;
  frozenWords: Word[];
}) {
  const [openedToday, setOpenedToday] = useState<Set<string>>(new Set());
  const [openedFrozen, setOpenedFrozen] = useState<Set<string>>(new Set());
  const [stage, setStage] = useState<"LEARN" | "TEST">(alreadyDoneToday ? "TEST" : "LEARN");
  const [frozenStage, setFrozenStage] = useState<"LEARN" | "TEST">("LEARN");
  const [donePulse, setDonePulse] = useState(false);

  const allTodayOpened = openedToday.size >= words.length && words.length > 0;
  const allFrozenOpened = openedFrozen.size >= frozenWords.length && frozenWords.length > 0;

  const todayIsToday = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const deadlineToday = frozenDayDeadline === todayIsToday;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-bmos-border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-bmos-text-light">Level {level}</p>
          <h2 className="text-xl font-extrabold text-bmos-text">
            Hari {progress.current_day} dari 30
          </h2>
        </div>
        <span
          className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
            progress.freeze_available
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {progress.freeze_available ? "🧊 Freeze tersedia" : "🧊 Freeze terpakai"}
        </span>
      </div>

      {frozenDay && frozenWords.length > 0 && (
        <div
          className={`rounded-2xl border p-5 ${
            deadlineToday
              ? "bg-red-50 border-red-200"
              : "bg-blue-50 border-blue-200"
          }`}
        >
          <p className="text-sm font-bold mb-1">
            {deadlineToday
              ? `⚠️ Kejar Hari ${frozenDay} HARI INI, atau progress reset ke Hari 1!`
              : `🧊 Hari ${frozenDay} kelewat, masih bisa dikejar pakai freeze.`}
          </p>
          <p className="text-xs text-bmos-text-light mb-3">
            Selesaikan 10 kosakata Hari {frozenDay} buat nyelametin progress kamu.
          </p>
          {frozenStage === "LEARN" ? (
            <div className="space-y-3">
              <FlashcardGrid words={frozenWords} opened={openedFrozen} onOpen={(id) => setOpenedFrozen((s) => new Set(s).add(id))} />
              <button
                disabled={!allFrozenOpened}
                onClick={() => setFrozenStage("TEST")}
                className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {allFrozenOpened ? "Mulai Test Susulan" : `Buka semua kartu dulu (${openedFrozen.size}/10)`}
              </button>
            </div>
          ) : (
            <QuizSection words={frozenWords} dayNumber={frozenDay} isMakeup onPassed={() => setDonePulse((p) => !p)} />
          )}
        </div>
      )}

      {progress.current_day > 30 ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <p className="text-3xl mb-2">🏆</p>
          <p className="font-bold text-green-700">Challenge 30 Hari selesai!</p>
        </div>
      ) : alreadyDoneToday ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="font-semibold text-green-700">
            Cap Hari {progress.current_day} udah didapat hari ini. Sampai ketemu besok!
          </p>
        </div>
      ) : (
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <h3 className="font-bold text-bmos-text mb-3">
            Kosakata Hari {progress.current_day}
          </h3>
          {stage === "LEARN" ? (
            <div className="space-y-3">
              <FlashcardGrid words={words} opened={openedToday} onOpen={(id) => setOpenedToday((s) => new Set(s).add(id))} />
              <button
                disabled={!allTodayOpened}
                onClick={() => setStage("TEST")}
                className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {allTodayOpened ? "Mulai Test" : `Buka semua kartu dulu (${openedToday.size}/10)`}
              </button>
            </div>
          ) : (
            <QuizSection
              words={words}
              dayNumber={progress.current_day}
              isMakeup={false}
              onPassed={() => setDonePulse((p) => !p)}
            />
          )}
        </div>
      )}
    </div>
  );
}
