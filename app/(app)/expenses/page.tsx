import { createClient } from "@/lib/supabase/server";
import AddExpenseButton from "./AddExpenseButton";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function ExpensesPage() {
  const supabase = await createClient();

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false });

  const total = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Operations
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text">Expenses</h1>
          <p className="text-bmos-text-light text-sm mt-1">
            Catat pengeluaran operasional.
          </p>
        </div>
        <AddExpenseButton />
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl p-5 mb-6 inline-block">
        <p className="text-sm text-bmos-text-light">Total Pengeluaran</p>
        <p className="text-2xl font-extrabold text-bmos-text mt-1">
          {formatCurrency(total)}
        </p>
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-bmos-text-light border-b border-bmos-border">
              <th className="px-5 py-3 font-medium">Deskripsi</th>
              <th className="px-5 py-3 font-medium">Kategori</th>
              <th className="px-5 py-3 font-medium">Jumlah</th>
              <th className="px-5 py-3 font-medium">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {(expenses ?? []).map((e) => (
              <tr key={e.id} className="border-b border-bmos-border last:border-0">
                <td className="px-5 py-3">
                  <p className="font-semibold text-bmos-text">
                    {e.description}
                  </p>
                  <p className="text-xs text-bmos-text-light">
                    {e.expense_code}
                  </p>
                </td>
                <td className="px-5 py-3 text-bmos-text">{e.category}</td>
                <td className="px-5 py-3 text-bmos-text font-medium">
                  {formatCurrency(e.amount)}
                </td>
                <td className="px-5 py-3 text-bmos-text">
                  {new Date(e.expense_date).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}

            {(!expenses || expenses.length === 0) && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-10 text-center text-bmos-text-light"
                >
                  Belum ada data pengeluaran.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
