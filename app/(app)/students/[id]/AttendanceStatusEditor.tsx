"use client";

import { useState } from "react";
import { updateAttendanceRecord } from "../../attendance/actions";

const STATUS_OPTIONS = [
  { value: "HADIR", label: "Hadir", color: "bg-green-100 text-green-700" },
  { value: "IZIN", label: "Izin", color: "bg-yellow-100 text-yellow-700" },
  { value: "ALPHA", label: "Alpha", color: "bg-red-100 text-red-700" },
];

export default function AttendanceStatusEditor({
  attendanceId,
  studentId,
  status,
}: {
  attendanceId: string;
  studentId: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(status);
  const [loading, setLoading] = useState(false);

  const opt =
    STATUS_OPTIONS.find((o) => o.value === current) ?? STATUS_OPTIONS[0];

  async function handlePick(value: string) {
    if (value === current) {
      setOpen(false);
      return;
    }
    setLoading(true);
    const result = await updateAttendanceRecord(attendanceId, value, studentId);
    setLoading(false);
    if (result.success) {
      setCurrent(value);
    }
    setOpen(false);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${opt.color} hover:opacity-80 transition disabled:opacity-50`}
      >
        {loading ? "..." : opt.label}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-bmos-border rounded-xl shadow-lg p-1 flex flex-col gap-0.5 min-w-[100px]">
            {STATUS_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => handlePick(o.value)}
                className={`text-left px-2 py-1.5 rounded-lg text-xs font-semibold hover:bg-bmos-primary-soft/40 transition ${
                  o.value === current ? o.color : "text-bmos-text"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
