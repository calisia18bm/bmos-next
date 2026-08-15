"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendPollsNow } from "./actions";

export default function SendPollsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleClick() {
    setLoading(true);
    setMessage("");
    const result = await sendPollsNow();
    setLoading(false);
    setMessage(result.message);
    if (result.success) router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="bg-bmos-primary text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
      >
        {loading ? "Mengirim..." : "📣 Kirim Vote Sekarang"}
      </button>
      {message && <p className="text-xs text-bmos-text-light">{message}</p>}
    </div>
  );
}
