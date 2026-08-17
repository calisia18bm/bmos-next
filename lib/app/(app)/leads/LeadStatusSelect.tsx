"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateLeadStatus } from "./actions";

const STATUSES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "TRIAL_BOOKED",
  "TRIAL_DONE",
  "FOLLOW_UP",
  "CONVERTED",
  "LOST",
];

const STATUS_STYLE: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700",
  CONTACTED: "bg-indigo-50 text-indigo-700",
  INTERESTED: "bg-purple-50 text-purple-700",
  TRIAL_BOOKED: "bg-yellow-50 text-yellow-700",
  TRIAL_DONE: "bg-orange-50 text-orange-700",
  FOLLOW_UP: "bg-pink-50 text-pink-700",
  CONVERTED: "bg-green-50 text-green-700",
  LOST: "bg-gray-100 text-gray-500",
};

export default function LeadStatusSelect({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [loading, setLoading] = useState(false);

  async function handleChange(newStatus: string) {
    setCurrent(newStatus);
    setLoading(true);
    await updateLeadStatus(id, newStatus);
    setLoading(false);
    router.refresh();
  }

  return (
    <select
      value={current}
      disabled={loading}
      onChange={(e) => handleChange(e.target.value)}
      className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-bmos-primary-light ${
        STATUS_STYLE[current] || "bg-gray-100 text-gray-600"
      }`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
