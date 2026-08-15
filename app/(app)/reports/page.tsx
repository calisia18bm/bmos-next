import { createClient } from "@/lib/supabase/server";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function ReportsPage() {
  const supabase = await createClient();

  const [
    { data: payments },
    { data: expenses },
    { data: students },
    { data: classes },
  ] = await Promise.all([
    supabase.from("payments").select("amount, payment_date"),
    supabase.from("expenses").select("amount, category, expense_date"),
    supabase.from("students").select("id, status, class_name"),
    supabase.from("classes").select("id, name"),
  ]);

  const totalIncome = (payments ?? []).reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );
  const totalExpense = (expenses ?? []).reduce(
    (sum, e) => sum + Number(e.amount),
    0
  );
  const netProfit = totalIncome - totalExpense;

  const activeStudents = (students ?? []).filter(
    (s) => s.status === "ACTIVE"
  ).length;

  // Breakdown pengeluaran per kategori
  const expenseByCategory: Record<string, number> = {};
  (expenses ?? []).forEach((e) => {
    expenseByCategory[e.category] =
      (expenseByCategory[e.category] || 0) + Number(e.amount);
  });

  // Breakdown murid per kelas
  const studentsByClass: Record<string, number> = {};
  (students ?? []).forEach((s) => {
    const name = s.class_name || "Belum ada kelas";
    studentsByClass[name] = (studentsByClass[name] || 0) + 1;
  });

  return (
    <div>
      <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
        Report
      </p>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-1">Reports</h1>
      <p className="text-bmos-text-light text-sm mb-6">
        Ringkasan performa bisnis secara keseluruhan.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <p className="text-sm text-bmos-text-light">Total Income</p>
          <p className="text-2xl font-extrabold text-green-700 mt-1">
            {formatCurrency(totalIncome)}
          </p>
        </div>
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <p className="text-sm text-bmos-text-light">Total Expenses</p>
          <p className="text-2xl font-extrabold text-red-600 mt-1">
            {formatCurrency(totalExpense)}
          </p>
        </div>
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <p className="text-sm text-bmos-text-light">Net Profit</p>
          <p
            className={`text-2xl font-extrabold mt-1 ${
              netProfit >= 0 ? "text-bmos-text" : "text-red-600"
            }`}
          >
            {formatCurrency(netProfit)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-bmos-border rounded-2xl p-6">
          <h2 className="font-bold text-bmos-text mb-4">
            Pengeluaran per Kategori
          </h2>
          <div className="space-y-3">
            {Object.entries(expenseByCategory).map(([cat, amount]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-sm text-bmos-text">{cat}</span>
                <span className="text-sm font-semibold text-bmos-text">
                  {formatCurrency(amount)}
                </span>
              </div>
            ))}
            {Object.keys(expenseByCategory).length === 0 && (
              <p className="text-sm text-bmos-text-light">Belum ada data.</p>
            )}
          </div>
        </div>

        <div className="bg-white border border-bmos-border rounded-2xl p-6">
          <h2 className="font-bold text-bmos-text mb-4">
            Murid per Kelas ({activeStudents} murid aktif)
          </h2>
          <div className="space-y-3">
            {Object.entries(studentsByClass).map(([cls, count]) => (
              <div key={cls} className="flex items-center justify-between">
                <span className="text-sm text-bmos-text">{cls}</span>
                <span className="text-sm font-semibold text-bmos-text">
                  {count} murid
                </span>
              </div>
            ))}
            {Object.keys(studentsByClass).length === 0 && (
              <p className="text-sm text-bmos-text-light">Belum ada data.</p>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-bmos-text-light mt-6">
        {classes?.length ?? 0} total kelas terdaftar di sistem.
      </p>
    </div>
  );
}
