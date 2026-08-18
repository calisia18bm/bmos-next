"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmChoice } from "./actions";

type ClassOption = {
  id: string;
  teacher_name: string | null;
  day_of_week: string | null;
  start_time: string | null;
};

export default function ChoiceSelector({
  studentId,
  classGroupName,
  options,
  currentChoice,
  confirmed,
}: {
  studentId: string;
  classGroupName: string;
  options: ClassOption[];
  currentChoice: string;
  confirmed: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentChoice);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!selected) return;
    setLoading(true);
    await confirmChoice(studentId, classGroupName, selected);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="text-xs border border-bmos-border rounded-lg px-2 py-1.5 focus:outline-none"
      >
        <option value="">Pilih jadwal</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.teacher_name} ({o.day_of_week}
            {o.start_time ? `, ${o.start_time.slice(0, 5)}` : ""})
          </option>
        ))}
      </select>
      <button
        onClick={handleConfirm}
        disabled={loading || !selected}
        className="text-xs font-semibold text-bmos-primary hover:underline disabled:opacity-50"
      >
        {confirmed ? "Ubah" : "Konfirmasi"}
      </button>
      {confirmed && (
        <span className="text-xs text-green-700 font-semibold">✓</span>
      )}
    </div>
  );
}
