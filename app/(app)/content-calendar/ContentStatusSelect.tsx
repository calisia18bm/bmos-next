"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateContentStatus } from "./actions";

const STATUS_STYLE: Record<string, string> = {
  PLANNED: "bg-blue-50 text-blue-700",
  DONE: "bg-green-50 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default function ContentStatusSelect({
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
    await updateContentStatus(id, newStatus);
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
      <option value="PLANNED">PLANNED</option>
      <option value="DONE">DONE</option>
      <option value="CANCELLED">CANCELLED</option>
    </select>
  );
}
