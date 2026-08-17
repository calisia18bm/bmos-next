"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTrialStatus, convertTrialToStudent } from "./actions";

const STATUSES = ["SCHEDULED", "DONE", "NO_SHOW", "CONVERTED"];

export default function TrialRowActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleStatusChange(newStatus: string) {
    setCurrent(newStatus);
    setLoading(true);
    await updateTrialStatus(id, newStatus);
    setLoading(false);
    router.refresh();
  }

  async function handleConvert() {
    setLoading(true);
    const result = await convertTrialToStudent(id);
    setLoading(false);
    setMessage(result.message);
    if (result.success) {
      setCurrent("CONVERTED");
      router.refresh();
    }
  }

  if (current === "CONVERTED") {
    return (
      <span className="text-xs font-semibold text-green-700">
        ✓ Sudah jadi murid
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={current}
        disabled={loading}
        onChange={(e) => handleStatusChange(e.target.value)}
        className="text-xs border border-bmos-border rounded-lg px-2 py-1 focus:outline-none"
      >
        {STATUSES.filter((s) => s !== "CONVERTED").map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        onClick={handleConvert}
        disabled={loading}
        className="text-xs font-semibold text-bmos-primary hover:underline disabled:opacity-50"
      >
        Jadikan Murid
      </button>
      {message && !message.includes("berhasil") && (
        <span className="text-xs text-red-600">{message}</span>
      )}
    </div>
  );
}
