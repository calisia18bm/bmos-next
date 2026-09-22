import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AddPaymentButton from "./AddPaymentButton";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

// Format bulan buat query & navigasi: "YYYY-MM".
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

// Halaman ini SENGAJA dibatasin per bulan (bukan narik SEMUA riwayat
// pembayaran dari awal berdiri sekali query) -- soalnya baris data di
// tabel payments bakal terus numpuk tiap ada Murid bayar (apalagi
// sekarang udah ada sistem bayar bulanan juga), jadi kalau ga dibatesin
// halaman ini bakal makin lama kebuka seiring waktu. Owner/Admin tinggal
// klik Prev/Next buat lihat bulan lain.
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isStaff = profile.roles.includes("OWNER") || profile.roles.includes("ADMIN");
  if (!isStaff) redirect("/");

  const { month: monthParam } = await searchParams;
  const currentMonthKey = monthKey(new Date());
  const activeMonthKey =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey;

  const [ay, am] = activeMonthKey.split("-").map(Number);
  const rangeStart = new Date(ay, am - 1, 1).toISOString().slice(0, 10);
  const rangeEnd = new Date(ay, am, 1).toISOString().slice(0, 10);
  const prevMonthKey = shiftMonth(activeMonthKey, -1);
  const nextMonthKey = shiftMonth(activeMonthKey, 1);
  const isCurrentMonth = activeMonthKey === currentMonthKey;

  const supabase = await createClient();

  const [{ data: payments }, { data: students }] = await Promise.all([
    supabase
      .from("payments")
      .select("*")
      .gte("payment_date", rangeStart)
      .lt("payment_date", rangeEnd)
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

      <div className="flex items-center gap-3 mb-4">
        <Link
          href={`/payments?month=${prevMonthKey}`}
          className="px-3 py-1.5 rounded-xl border border-bmos-border text-sm text-bmos-text hover:bg-gray-50 transition"
        >
          ← Bulan Sebelumnya
        </Link>
        <p className="text-sm font-semibold text-bmos-text">
          {monthLabel(activeMonthKey)}
        </p>
        {!isCurrentMonth && (
          <Link
            href={`/payments?month=${nextMonthKey}`}
            className="px-3 py-1.5 rounded-xl border border-bmos-border text-sm text-bmos-text hover:bg-gray-50 transition"
          >
            Bulan Berikutnya →
          </Link>
        )}
        {!isCurrentMonth && (
          <Link
            href="/payments"
            className="text-xs font-semibold text-bmos-primary hover:underline ml-1"
          >
            Kembali ke bulan ini
          </Link>
        )}
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
                  Belum ada data pembayaran di {monthLabel(activeMonthKey)}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
