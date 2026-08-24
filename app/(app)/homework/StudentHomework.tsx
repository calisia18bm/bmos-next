"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitHomework } from "./actions";

type HomeworkItem = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
};

type Submission = {
  submission_type: string;
  answer_text: string | null;
  file_url: string | null;
  file_name: string | null;
  submitted_at: string;
};

const TYPE_OPTIONS: { value: "TEXT" | "AUDIO" | "VIDEO" | "FILE"; label: string; accept?: string }[] = [
  { value: "TEXT", label: "📝 Teks" },
  { value: "AUDIO", label: "🎤 Suara", accept: "audio/*" },
  { value: "VIDEO", label: "🎥 Video", accept: "video/*" },
  { value: "FILE", label: "📎 File Lain", accept: undefined },
];

function SubmitForm({ homeworkId, onDone }: { homeworkId: string; onDone: () => void }) {
  const [type, setType] = useState<"TEXT" | "AUDIO" | "VIDEO" | "FILE">("TEXT");
  const [answerText, setAnswerText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let fileUrl = "";
      let fileName = "";
      let filePath = "";

      if (type !== "TEXT") {
        if (!file) {
          setError("Pilih file dulu.");
          setLoading(false);
          return;
        }
        const supabase = createClient();
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${homeworkId}/${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("homework-submissions")
          .upload(path, file);
        if (uploadError) {
          setError(`Gagal upload file: ${uploadError.message}`);
          setLoading(false);
          return;
        }
        const { data } = supabase.storage.from("homework-submissions").getPublicUrl(path);
        fileUrl = data.publicUrl;
        fileName = file.name;
        filePath = path;
      }

      const result = await submitHomework({
        homeworkId,
        submissionType: type,
        answerText,
        fileUrl,
        fileName,
        filePath,
      });

      if (!result.success) {
        setError(result.message);
        return;
      }
      onDone();
    } finally {
      setLoading(false);
    }
  }

  const selected = TYPE_OPTIONS.find((o) => o.value === type);

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-bmos-border pt-3">
      <div className="flex flex-wrap gap-2">
        {TYPE_OPTIONS.map((o) => (
          <button
            type="button"
            key={o.value}
            onClick={() => {
              setType(o.value);
              setFile(null);
            }}
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border transition ${
              type === o.value
                ? "bg-bmos-primary text-white border-bmos-primary"
                : "bg-white text-bmos-text-light border-bmos-border hover:border-bmos-primary-light"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {type === "TEXT" ? (
        <textarea
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          rows={3}
          placeholder="Tulis jawaban kamu di sini"
          className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
        />
      ) : (
        <input
          type="file"
          accept={selected?.accept}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm"
        />
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-xs font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
        >
          {loading ? "Mengirim..." : "Submit Jawaban"}
        </button>
      </div>
    </form>
  );
}

export default function StudentHomework({
  homeworks,
  mySubmissions,
  disabled,
}: {
  homeworks: HomeworkItem[];
  mySubmissions: Record<string, Submission>;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (homeworks.length === 0) {
    return (
      <div className="bg-white border border-bmos-border rounded-2xl p-10 text-center text-sm text-bmos-text-light">
        Belum ada PR buat kelas kamu.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {homeworks.map((hw) => {
        const mySub = mySubmissions[hw.id];
        const isEditing = editingId === hw.id;
        return (
          <div key={hw.id} className="bg-white border border-bmos-border rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-bmos-text">{hw.title}</p>
                {hw.due_date && (
                  <p className="text-xs text-bmos-text-light">Deadline {hw.due_date}</p>
                )}
                {hw.description && (
                  <p className="text-sm text-bmos-text-light mt-1">{hw.description}</p>
                )}
              </div>
              <span
                className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full ${
                  mySub ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {mySub ? "Sudah Submit" : "Belum Submit"}
              </span>
            </div>

            {mySub && !isEditing && (
              <div className="mt-2 bg-gray-50 rounded-xl p-3 text-sm">
                <p className="text-xs text-bmos-text-light mb-1">
                  Jawaban kamu ({new Date(mySub.submitted_at).toLocaleString("id-ID")}):
                </p>
                {mySub.submission_type === "TEXT" ? (
                  <p className="whitespace-pre-line">{mySub.answer_text}</p>
                ) : mySub.submission_type === "AUDIO" && mySub.file_url ? (
                  <audio controls src={mySub.file_url} className="w-full" />
                ) : mySub.submission_type === "VIDEO" && mySub.file_url ? (
                  <video controls src={mySub.file_url} className="w-full max-h-64 rounded-lg" />
                ) : (
                  mySub.file_url && (
                    <a
                      href={mySub.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-bmos-primary hover:underline"
                    >
                      📎 {mySub.file_name || "Buka file"}
                    </a>
                  )
                )}
                {!disabled && (
                  <button
                    onClick={() => setEditingId(hw.id)}
                    className="mt-2 text-xs font-semibold text-bmos-primary hover:underline block"
                  >
                    Submit ulang / ganti jawaban
                  </button>
                )}
              </div>
            )}

            {!disabled && (!mySub || isEditing) && (
              <SubmitForm
                homeworkId={hw.id}
                onDone={() => {
                  setEditingId(null);
                  router.refresh();
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
