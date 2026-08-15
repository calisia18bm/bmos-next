import { createClient } from "@/lib/supabase/server";
import GeneratePayrollButton from "./GeneratePayrollButton";
import PayrollRowActions from "./PayrollRowActions";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  APPROVED: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
};

export default async function PayrollPage() {
  const supabase = await createClient();

  const [{ data: payroll }, { data: teachers }] = await Promise.all([
    supabase.from("payroll").select("*").order("created_at", { ascending: false }),
    supabase.from("teachers").select("id, name").eq("active", true),
  ]);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Operations
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text">Payroll</h1>
          <p className="text-bmos-text-light text-sm mt-1">
            Hitung dan kelola gaji laoshi berdasarkan sesi mengajar.
          </p>
        </div>
        <GeneratePayrollButton teachers={teachers ?? []} />
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-bmos-text-light border-b border-bmos-border">
              <th className="px-5 py-3 font-medium">Laoshi</th>
              <th className="px-5 py-3 font-medium">Periode</th>
              <th className="px-5 py-3 font-medium">Sesi</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(payroll ?? []).map((p) => (
              <tr key={p.id} className="border-b border-bmos-border last:border-0">
                <td className="px-5 py-3">
                  <p className="font-semibold text-bmos-text">
                    {p.teacher_name}
                  </p>
                  <p className="text-xs text-bmos-text-light">
                    {p.payroll_code}
                  </p>
                </td>
                <td className="px-5 py-3 text-bmos-text">
                  {new Date(p.period_start).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  -{" "}
                  {new Date(p.period_end).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-5 py-3 text-bmos-text">
                  {p.sessions_count}x
                </td>
                <td className="px-5 py-3 text-bmos-text font-medium">
                  {formatCurrency(p.total_amount)}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                      STATUS_STYLE[p.status] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <PayrollRowActions id={p.id} status={p.status} />
                </td>
              </tr>
            ))}

            {(!payroll || payroll.length === 0) && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-bmos-text-light"
                >
                  Belum ada data payroll.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
