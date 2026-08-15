import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Hari ini";
  if (days === 1) return "1 hari lalu";
  return `${days} hari lalu`;
}

function getMondayOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .slice(0, 10);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    .toISOString()
    .slice(0, 10);

  const [
    { count: studentCount },
    { count: classCount },
    { data: todaySessions },
    { data: classesForOccupancy },
    { data: paymentsThisMonth },
    { data: paymentsLastMonth },
    { data: recentStudents },
    { data: recentPayments },
    { count: trialsCount },
  ] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "ACTIVE"),
    supabase.from("classes").select("*", { count: "exact", head: true }).eq("active", true),
    supabase.from("sessions").select("*").eq("session_date", today).order("start_time"),
    supabase.from("classes").select("id, name, capacity_max").eq("active", true),
    supabase.from("payments").select("amount, student_id").gte("payment_date", monthStart),
    supabase.from("payments").select("amount").gte("payment_date", lastMonthStart).lte("payment_date", lastMonthEnd),
    supabase.from("students").select("id, name, created_at").order("created_at", { ascending: false }).limit(3),
    supabase.from("payments").select("id, student_name, amount, payment_date").order("payment_date", { ascending: false }).limit(5),
    supabase.from("trials").select("*", { count: "exact", head: true }).eq("status", "SCHEDULED"),
  ]);

  // ===== Class Occupancy =====
  const classIds = (classesForOccupancy ?? []).map((c) => c.id);
  const { data: studentCounts } = classIds.length
    ? await supabase.from("students").select("class_id").in("class_id", classIds).eq("status", "ACTIVE")
    : { data: [] };

  const countByClass: Record<string, number> = {};
  (studentCounts ?? []).forEach((s) => {
    if (s.class_id) countByClass[s.class_id] = (countByClass[s.class_id] || 0) + 1;
  });

  let fullCount = 0, mediumCount = 0, lowCount = 0;
  (classesForOccupancy ?? []).forEach((c) => {
    const enrolled = countByClass[c.id] || 0;
    const cap = c.capacity_max || 6;
    const pct = cap > 0 ? enrolled / cap : 0;
    if (pct >= 1) fullCount++;
    else if (pct >= 0.5) mediumCount++;
    else lowCount++;
  });
  const totalClasses = (classesForOccupancy ?? []).length || 1;
  const avgOccupancy = Math.round(
    ((fullCount * 100 + mediumCount * 65 + lowCount * 25) / (totalClasses * 100)) * 100
  );

  // ===== Income Overview =====
  const totalIncomeThisMonth = (paymentsThisMonth ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalIncomeLastMonth = (paymentsLastMonth ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const incomeChangePct = totalIncomeLastMonth > 0
    ? Math.round(((totalIncomeThisMonth - totalIncomeLastMonth) / totalIncomeLastMonth) * 100)
    : totalIncomeThisMonth > 0 ? 100 : 0;

  // ===== Revenue by Category (per kelas) =====
  const studentIds = [...new Set((paymentsThisMonth ?? []).map((p) => p.student_id).filter(Boolean))];
  const { data: studentsForRevenue } = studentIds.length
    ? await supabase.from("students").select("id, class_name").in("id", studentIds)
    : { data: [] };
  const studentClassMap: Record<string, string> = {};
  (studentsForRevenue ?? []).forEach((s) => {
    studentClassMap[s.id] = s.class_name || "Lainnya";
  });
  const revenueByClass: Record<string, number> = {};
  (paymentsThisMonth ?? []).forEach((p) => {
    const cls = studentClassMap[p.student_id] || "Lainnya";
    revenueByClass[cls] = (revenueByClass[cls] || 0) + Number(p.amount);
  });
  const revenueEntries = Object.entries(revenueByClass).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ===== Recent Activities (gabung murid baru + payment) =====
  type Activity = { icon: string; title: string; subtitle: string; date: string };
  const activities: Activity[] = [
    ...(recentStudents ?? []).map((s) => ({
      icon: "👤",
      title: s.name,
      subtitle: "Murid baru terdaftar",
      date: s.created_at,
    })),
    ...(recentPayments ?? []).map((p) => ({
      icon: "💳",
      title: "Pembayaran diterima",
      subtitle: `${p.student_name} - ${formatCurrency(p.amount)}`,
      date: p.payment_date,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  // ===== Need Attention =====
  type Attention = { icon: string; title: string; subtitle: string; href: string };
  const attentionItems: Attention[] = [];

  const { count: inactiveClassCount } = await supabase
    .from("classes")
    .select("*", { count: "exact", head: true })
    .eq("active", false);

  if (inactiveClassCount && inactiveClassCount > 0) {
    attentionItems.push({
      icon: "📕",
      title: `${inactiveClassCount} kelas tidak aktif`,
      subtitle: "Tidak ada aktivitas terjadwal.",
      href: "/classes",
    });
  }

  const byName: Record<string, number> = {};
  const nameToClassIds: Record<string, string[]> = {};
  (classesForOccupancy ?? []).forEach((c) => {
    byName[c.name] = (byName[c.name] || 0) + 1;
    nameToClassIds[c.name] = [...(nameToClassIds[c.name] || []), c.id];
  });
  const flexibleClassIds = Object.entries(byName)
    .filter(([, count]) => count > 1)
    .flatMap(([name]) => nameToClassIds[name]);

  if (flexibleClassIds.length > 0) {
    const weekStart = getMondayOfWeek();
    const { data: flexStudents } = await supabase
      .from("students")
      .select("id")
      .in("class_id", flexibleClassIds)
      .eq("status", "ACTIVE");
    const { data: confirmedChoices } = await supabase
      .from("weekly_choices")
      .select("student_id")
      .eq("week_start", weekStart)
      .eq("confirmed", true);
    const confirmedIds = new Set((confirmedChoices ?? []).map((c) => c.student_id));
    const unconfirmed = (flexStudents ?? []).filter((s) => !confirmedIds.has(s.id)).length;

    if (unconfirmed > 0) {
      attentionItems.push({
        icon: "🔄",
        title: `${unconfirmed} murid belum konfirmasi pilihan mingguan`,
        subtitle: "Kelas fleksibel perlu konfirmasi laoshi minggu ini.",
        href: "/weekly-choice",
      });
    }
  }

  return (
    <div>
      <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
        Overview
      </p>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-6">
        Selamat datang 👋
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Students" value={studentCount ?? 0} icon="🧑‍🎓" />
        <StatCard label="Classes" value={classCount ?? 0} icon="📚" />
        <StatCard label="Total Income" value={formatCurrency(totalIncomeThisMonth)} icon="💳" />
        <StatCard label="Trials Terjadwal" value={trialsCount ?? 0} icon="🎯" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white border border-bmos-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-bmos-text text-lg">Today&apos;s Schedule</h2>
            <span className="text-xs text-bmos-text-light">
              {(todaySessions ?? []).length} classes today
            </span>
          </div>
          {(todaySessions ?? []).length === 0 ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-bmos-text font-semibold">Tidak ada kelas hari ini</p>
              <p className="text-sm text-bmos-text-light">Jadwal hari ini masih kosong.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(todaySessions ?? []).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 bg-bmos-primary-soft/30 rounded-xl"
                >
                  <div>
                    <p className="text-sm font-semibold text-bmos-text">{s.class_name}</p>
                    <p className="text-xs text-bmos-text-light">
                      {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)} · {s.teacher_planned}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-bmos-primary">{s.status}</span>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/weekly-schedule"
            className="inline-block mt-4 text-sm font-semibold text-bmos-primary hover:underline"
          >
            View full schedule →
          </Link>
        </div>

        <div className="bg-white border border-bmos-border rounded-2xl p-6">
          <h2 className="font-bold text-bmos-text text-lg mb-4">Class Occupancy</h2>
          <div className="flex flex-col items-center">
            <div className="w-28 h-28 rounded-full border-8 border-green-200 flex items-center justify-center mb-4">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-bmos-text">{avgOccupancy}%</p>
                <p className="text-[10px] text-bmos-text-light">Average</p>
              </div>
            </div>
            <div className="w-full space-y-2 text-sm">
              <OccupancyRow color="bg-red-400" label="Full" value={fullCount} />
              <OccupancyRow color="bg-orange-400" label="Medium" value={mediumCount} />
              <OccupancyRow color="bg-blue-400" label="Low" value={lowCount} />
              <OccupancyRow color="bg-green-400" label="Trial Class" value={trialsCount ?? 0} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-bmos-border rounded-2xl p-6">
          <h2 className="font-bold text-bmos-text text-lg mb-4">Income Overview</h2>
          <p className="text-sm text-bmos-text-light">Total Income</p>
          <p className="text-3xl font-extrabold text-bmos-text mt-1">
            {formatCurrency(totalIncomeThisMonth)}
          </p>
          <p
            className={`text-sm mt-1 ${
              incomeChangePct >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {incomeChangePct >= 0 ? "↑" : "↓"}
            {Math.abs(incomeChangePct)}% vs last month
          </p>
        </div>

        <div className="bg-white border border-bmos-border rounded-2xl p-6">
          <h2 className="font-bold text-bmos-text text-lg mb-1">Revenue by Category</h2>
          <p className="text-xs text-bmos-text-light mb-4">
            Kontribusi tiap kategori kelas bulan ini
          </p>
          {revenueEntries.length === 0 ? (
            <p className="text-center text-bmos-text-light py-8 text-sm">
              Belum ada pemasukan bulan ini
            </p>
          ) : (
            <div className="space-y-2">
              {revenueEntries.map(([name, amount]) => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <span className="text-bmos-text">{name}</span>
                  <span className="font-semibold text-bmos-text">
                    {formatCurrency(amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-bmos-border rounded-2xl p-6">
          <h2 className="font-bold text-bmos-text text-lg mb-4">Recent Activities</h2>
          <div className="space-y-1">
            {activities.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-bmos-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-bmos-primary-soft flex items-center justify-center text-sm">
                    {a.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-bmos-text">{a.title}</p>
                    <p className="text-xs text-bmos-text-light">{a.subtitle}</p>
                  </div>
                </div>
                <span className="text-xs text-bmos-text-light whitespace-nowrap">
                  {timeAgo(a.date)}
                </span>
              </div>
            ))}
            {activities.length === 0 && (
              <p className="text-sm text-bmos-text-light text-center py-6">
                Belum ada aktivitas.
              </p>
            )}
          </div>
        </div>

        <div className="bg-white border border-bmos-border rounded-2xl p-6">
          <h2 className="font-bold text-bmos-text text-lg mb-1">Need Attention</h2>
          <p className="text-xs text-bmos-text-light mb-4">
            Prioritas yang perlu ditindaklanjuti
          </p>
          <div className="space-y-2">
            {attentionItems.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="flex items-center justify-between p-3 border border-bmos-border rounded-xl hover:bg-bmos-primary-soft/30 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-bmos-primary-soft flex items-center justify-center text-sm">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-bmos-text">{item.title}</p>
                    <p className="text-xs text-bmos-text-light">{item.subtitle}</p>
                  </div>
                </div>
                <span className="text-bmos-text-light">›</span>
              </Link>
            ))}
            {attentionItems.length === 0 && (
              <p className="text-sm text-bmos-text-light text-center py-6">
                Semua aman, tidak ada yang perlu ditindaklanjuti 🎉
              </p>
            )}
          </div>
        </div>
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

function OccupancyRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-bmos-text-light">{label}</span>
      </div>
      <span className="font-semibold text-bmos-text">{value} classes</span>
    </div>
  );
}
