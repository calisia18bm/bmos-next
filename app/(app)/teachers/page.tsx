import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AddTeacherButton from "./AddTeacherButton";
import EditTeacherButton from "./EditTeacherButton";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

// Rate laoshi bisa "per sesi" (rate_per_session x jumlah sesi) atau "per
// paket" (flat per sekian sesi selesai) -- tampilin sesuai rate_type-nya
// biar ga salah baca.
function formatRate(t: { rate_type: string | null; rate_per_session: number | null; rate_per_package: number | null; sessions_per_payout: number | null }) {
  if (t.rate_type === "PACKAGE") {
    return `${formatCurrency(t.rate_per_package || 0)} / ${t.sessions_per_payout || 8} sesi`;
  }
  return `${formatCurrency(t.rate_per_session || 0)} / sesi`;
}

export default async function TeachersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isStaff = profile.roles.includes("OWNER") || profile.roles.includes("ADMIN");
  if (!isStaff) redirect("/");

  const supabase = await createClient();

  const { data: teachers } = await supabase
    .from("teachers")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Master Data
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text">Teachers</h1>
          <p className="text-bmos-text-light text-sm mt-1">
            Kelola data laoshi dan rate (per sesi atau per paket).
          </p>
        </div>
        <AddTeacherButton />
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-bmos-text-light border-b border-bmos-border">
              <th className="px-5 py-3 font-medium">Laoshi</th>
              <th className="px-5 py-3 font-medium">Kontak</th>
              <th className="px-5 py-3 font-medium">Rate</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(teachers ?? []).map((t) => (
              <tr
                key={t.id}
                className="border-b border-bmos-border last:border-0 hover:bg-bmos-primary-soft/30"
              >
                <td className="px-5 py-3">
                  <Link href={`/teachers/${t.id}`} className="block">
                    <p className="font-semibold text-bmos-text">{t.name}</p>
                    <p className="text-xs text-bmos-text-light">
                      {t.teacher_code}
                    </p>
                  </Link>
                </td>
                <td className="px-5 py-3 text-bmos-text">{t.phone || "-"}</td>
                <td className="px-5 py-3 text-bmos-text">{formatRate(t)}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                      t.active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {t.active ? "Aktif" : "Non-Aktif"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <EditTeacherButton teacher={t} />
                </td>
              </tr>
            ))}

            {(!teachers || teachers.length === 0) && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-10 text-center text-bmos-text-light"
                >
                  Belum ada data laoshi.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
