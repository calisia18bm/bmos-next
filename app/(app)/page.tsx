import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: studentCount }, { count: classCount }] = await Promise.all([
    supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("status", "ACTIVE"),
    supabase
      .from("classes")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
  ]);

  return (
    <div>
      <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
        Overview
      </p>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-6">
        Selamat datang 👋
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Students" value={studentCount ?? 0} icon="🧑‍🎓" />
        <StatCard label="Classes" value={classCount ?? 0} icon="📚" />
        <StatCard label="Total Income" value="Rp 0" icon="💳" />
        <StatCard label="Net Profit" value="Rp 0" icon="📈" />
      </div>

      <div className="mt-8 bg-white border border-bmos-border rounded-2xl p-6">
        <p className="text-sm text-bmos-text-light">
          Ini fondasi awal migrasi BMOS ke Next.js + Supabase. Data di atas
          sudah beneran diambil dari database baru — bukan dummy. Halaman
          Students, Teachers, dst masih akan ditambahkan bertahap.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="bg-white border border-bmos-border rounded-2xl p-5">
      <div className="w-10 h-10 rounded-xl bg-bmos-primary-soft flex items-center justify-center text-lg mb-3">
        {icon}
      </div>
      <p className="text-sm text-bmos-text-light">{label}</p>
      <p className="text-2xl font-extrabold text-bmos-text mt-1">{value}</p>
    </div>
  );
}
