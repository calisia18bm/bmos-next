import { createClient } from "@/lib/supabase/server";
import AddPaymentButton from "./AddPaymentButton";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function PaymentsPage() {
  const supabase = await createClient();

  const [{ data: payments }, { data: students }] = await Promise.all([
    supabase
      .from("payments")
      .select("*")
      .order("payment_date", { ascending: false }),
    supabase.from("students").select("id, name").eq("status", "ACTIVE"),
  ]);

  const total = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Operations
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text">Payments</h1>
          <p className="text-bmos-text-light text-sm mt-1">
            Riwayat pembayaran murid.
          </p>
        </div>
        <AddPaymentButton students={students ?? []} />
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl p-5 mb-6 inline-block">
        <p className="text-sm text-bmos-text-light">Total Pemasukan</p>
        <p className="text-2xl font-extrabold text-bmos-text mt-1">
          {formatCurrency(total)}
        </p>
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-bmos-text-light border-b border-bmos-border">
              <th className="px-5 py-3 font-medium">Murid</th>
              <th className="px-5 py-3 font-medium">Jumlah</th>
              <th className="px-5 py-3 font-medium">Tanggal</th>
              <th className="px-5 py-3 font-medium">Metode</th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p) => (
              <tr key={p.id} className="border-b border-bmos-border last:border-0">
                <td className="px-5 py-3">
                  <p className="font-semibold text-bmos-text">
                    {p.student_name}
                  </p>
                  <p className="text-xs text-bmos-text-light">
                    {p.transaction_code}
                  </p>
                </td>
                <td className="px-5 py-3 text-bmos-text font-medium">
                  {formatCurrency(p.amount)}
                </td>
                <td className="px-5 py-3 text-bmos-text">
                  {new Date(p.payment_date).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-5 py-3 text-bmos-text">{p.method || "-"}</td>
              </tr>
            ))}

            {(!payments || payments.length === 0) && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-10 text-center text-bmos-text-light"
                >
                  Belum ada data pembayaran.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
