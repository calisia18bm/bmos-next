"use client";

import { useState } from "react";
import { generateUpcomingSessions } from "./actions";

export default function GenerateSessionsButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleClick() {
    setLoading(true);
    setMessage("");
    const result = await generateUpcomingSessions(60);
    setLoading(false);
    setMessage(result.message);
  }

  return (
    <div className="flex items-center gap-3">
      {message && <p className="text-xs text-bmos-text-light">{message}</p>}
      <button
        onClick={handleClick}
        disabled={loading}
        className="bg-white border border-bmos-border text-bmos-text rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-bmos-primary-soft transition disabled:opacity-60"
      >
        {loading ? "Generating..." : "🔄 Generate Sessions"}
      </button>
    </div>
  );
}
