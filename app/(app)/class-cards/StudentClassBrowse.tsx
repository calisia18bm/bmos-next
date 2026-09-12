"use client";

import { useState } from "react";
import { joinClassCard } from "./actions";
import { ClassCard, formatRupiah } from "@/lib/classCards";

export default function StudentClassBrowse({
  cards,
  countByClass,
  alreadyHasClass,
  disabled,
  registrationFormUrl,
}: {
  cards: ClassCard[];
  countByClass: Record<string, number>;
  alreadyHasClass: boolean;
  disabled?: boolean;
  registrationFormUrl?: string | null;
}) {
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; ok: boolean } | null>(
    null
  );

  const today = new Date().toISOString().slice(0, 10);

  async function handleJoin(cardId: string, className: string) {
    if (disabled) return;
    const confirmed = window.confirm(`Join kelas "${className}"?`);
    if (!confirmed) return;

    setJoiningId(cardId);
    setMessage(null);
    const result = await joinClassCard(cardId);
    setJoiningId(null);
    setMessage({ id: cardId, text: result.message, ok: result.success });
  }

  if (alreadyHasClass) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
        Kamu udah terdaftar di sebuah kelas. Kalau mau pindah kelas,
        hubungi Admin ya.
      </div>
    );
  }

  const registrationBanner = registrationFormUrl && (
    <a
      href={registrationFormUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-bmos-primary-soft border border-bmos-primary-light rounded-2xl p-4 mb-4 text-sm text-bmos-text hover:opacity-90 transition"
    >
      <p className="font-semibold text-bmos-primary">
        📝 Belum yakin kelas mana yang cocok?
      </p>
      <p className="text-bmos-text-light mt-0.5">
        Isi kuisioner ini dulu biar kami bantu arahkan ke kelas yang sesuai
        tujuan belajar kamu →
      </p>
    </a>
  );

  if (cards.length === 0) {
    return (
      <div>
        {registrationBanner}
        <div className="bg-white border border-bmos-border rounded-2xl p-10 text-center text-sm text-bmos-text-light">
          Belum ada kelas yang bisa dipilih saat ini.
        </div>
      </div>
    );
  }

  return (
    <div>
      {registrationBanner}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => {
        const filled = countByClass[c.id] ?? 0;
        const isFull = filled >= c.capacity_max;
        const notOpenYet = c.registration_start && today < c.registration_start;
        const closed = c.registration_end && today > c.registration_end;
        const canJoin = !isFull && !notOpenYet && !closed && !disabled;

        return (
          <div
            key={c.id}
            className="bg-white border border-bmos-border rounded-2xl p-4 flex flex-col gap-2"
          >
            <p className="font-bold text-bmos-text flex items-center gap-1.5">
              {c.name}
              {c.is_private && (
                <span className="text-[10px] font-semibold bg-bmos-primary-soft text-bmos-primary px-2 py-0.5 rounded-full">
                  Private
                </span>
              )}
            </p>
            <p className="text-xs text-bmos-text-light">
              👩‍🏫 {c.teacher_name || "-"}
            </p>
            <p className="text-xs text-bmos-text-light">
              {c.day_of_week
                ? `${c.day_of_week} · ${c.start_time?.slice(0, 5) || ""}-${
                    c.end_time?.slice(0, 5) || ""
                  }`
                : "Jadwal belum diatur"}
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

            {c.price && (
              <p className="text-sm font-semibold text-bmos-text">
                {formatRupiah(c.price)}{" "}
                <span className="font-normal text-xs text-bmos-text-light">
                  / {c.sessions_count ?? "-"} sesi
                </span>
              </p>
            )}

            <p className="text-xs text-bmos-text-light">
              Kuota: {filled}/{c.capacity_max}
              {isFull ? " · Penuh" : ""}
            </p>

            {notOpenYet && (
              <p className="text-xs text-yellow-700">
                Pendaftaran dibuka {c.registration_start}
              </p>
            )}
            {closed && !notOpenYet && (
              <p className="text-xs text-red-600">Pendaftaran udah ditutup</p>
            )}

            {message?.id === c.id && (
              <p
                className={`text-xs rounded-lg px-2.5 py-1.5 ${
                  message.ok
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {message.text}
              </p>
            )}

            <button
              onClick={() => handleJoin(c.id, c.name)}
              disabled={!canJoin || joiningId === c.id}
              className="mt-1 bg-bmos-primary text-white rounded-xl py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joiningId === c.id
                ? "Memproses..."
                : isFull
                ? "Kelas Penuh"
                : "Join Kelas"}
            </button>
          </div>
        );
      })}
      </div>
    </div>
  );
}
