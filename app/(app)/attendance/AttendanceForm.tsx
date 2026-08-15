"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveAttendance } from "./actions";

type Student = { id: string; name: string; student_code: string };
type ExistingAttendance = { student_id: string; status: string };

const STATUS_OPTIONS = [
  { value: "HADIR", label: "Hadir", color: "bg-green-100 text-green-700" },
  { value: "IZIN", label: "Izin", color: "bg-yellow-100 text-yellow-700" },
  { value: "ALPHA", label: "Alpha", color: "bg-red-100 text-red-700" },
];

export default function AttendanceForm({
  classId,
  date,
  students,
  existing,
}: {
  classId: string;
  date: string;
  students: Student[];
  existing: ExistingAttendance[];
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    students.forEach((s) => {
      const found = existing.find((e) => e.student_id === s.id);
      initial[s.id] = found?.status || "HADIR";
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setLoading(true);
    setMessage("");

    const records = students.map((s) => ({
      studentId: s.id,
      status: statuses[s.id] || "HADIR",
    }));

    const result = await saveAttendance(classId, date, records);

    setLoading(false);
    setMessage(result.message);

    if (result.success) {
      router.refresh();
    }
  }

  if (students.length === 0) {
    return (
      <div className="bg-white border border-bmos-border rounded-2xl p-10 text-center text-bmos-text-light">
        Belum ada murid di kelas ini.
      </div>
    );
  }

  return (
    <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-bmos-text-light border-b border-bmos-border">
            <th className="px-5 py-3 font-medium">Murid</th>
            <th className="px-5 py-3 font-medium">Kehadiran</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id} className="border-b border-bmos-border last:border-0">
              <td className="px-5 py-3">
                <p className="font-semibold text-bmos-text">{s.name}</p>
                <p className="text-xs text-bmos-text-light">
                  {s.student_code}
                </p>
              </td>
              <td className="px-5 py-3">
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() =>
                        setStatuses((prev) => ({
                          ...prev,
                          [s.id]: opt.value,
                        }))
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                        statuses[s.id] === opt.value
                          ? opt.color
                          : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="p-4 border-t border-bmos-border flex items-center justify-between">
        {message && (
          <p className="text-sm text-bmos-text-light">{message}</p>
        )}
        <button
          onClick={handleSave}
          disabled={loading}
          className="ml-auto bg-bmos-primary text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
        >
          {loading ? "Menyimpan..." : "Simpan Absensi"}
        </button>
      </div>
    </div>
  );
}
