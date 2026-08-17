"use client";

import { useRouter, useSearchParams } from "next/navigation";

type ClassOption = { id: string; name: string };

export default function ClassDateSelector({
  classes,
}: {
  classes: ClassOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const classId = searchParams.get("classId") || "";
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  function updateParams(next: { classId?: string; date?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.classId !== undefined) params.set("classId", next.classId);
    if (next.date !== undefined) params.set("date", next.date);
    router.push(`/attendance?${params.toString()}`);
  }

  return (
    <div className="bg-white border border-bmos-border rounded-2xl p-5 mb-6 flex flex-wrap gap-4 items-end">
      <div>
        <label className="block text-sm font-medium text-bmos-text mb-1">
          Kelas
        </label>
        <select
          value={classId}
          onChange={(e) => updateParams({ classId: e.target.value })}
          className="border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light min-w-[220px]"
        >
          <option value="">Pilih kelas</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-bmos-text mb-1">
          Tanggal
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => updateParams({ date: e.target.value })}
          className="border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
        />
      </div>
    </div>
  );
}
