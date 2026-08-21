"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Option = { id: string; name: string; code?: string | null };

// Dropdown khusus buat OWNER (bukan Admin) buat milih Laoshi/Murid
// tertentu, biar bisa liat PERSIS data asli orang itu di halaman
// My Schedule / My Student / My Payroll / My Class / Payment Saya --
// bukan cuma preview kosong. Query param yang dibawa (teacherId/
// studentId) cuma dibaca server-side kalau pengunjungnya beneran OWNER
// (dicek lagi di page.tsx), jadi Admin/role lain ga bisa manfaatin ini.
export default function OwnerPreviewPicker({
  paramKey,
  options,
  selectedId,
  roleLabel,
}: {
  paramKey: "teacherId" | "studentId";
  options: Option[];
  selectedId: string | null;
  roleLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set(paramKey, id);
    else params.delete(paramKey);
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
      <label className="block text-xs font-semibold text-blue-800 mb-2">
        👁️ Owner Preview -- pilih {roleLabel} buat liat data aslinya
      </label>
      <select
        value={selectedId || ""}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full sm:w-80 border border-blue-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        <option value="">-- Pilih {roleLabel} --</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.code ? ` (${o.code})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
