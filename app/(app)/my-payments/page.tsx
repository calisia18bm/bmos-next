import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function MyPaymentsPage() {
  const profile = await getCurrentProfile();
  const isStaff =
    profile?.roles?.includes("OWNER") || profile?.roles?.includes("ADMIN");
  const isStudent = profile?.roles?.includes("STUDENT");

  // Owner/Admin boleh buka buat preview tampilan Murid -- sebelumnya
  // ke-redirect balik ke Home karena role-nya bukan STUDENT.
  if (!profile || (!isStudent && !isStaff)) {
    redirect("/");
  }

  const supabase = await createClient();

  if (!profile.student_id) {
    return (
      <div>
        <h1 className="text-3xl font-extrabold text-bmos-text mb-4">
          Payment Saya
        </h1>
        {isStaff ? (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
            👁️ Preview tampilan Murid -- akun kamu (Owner/Admin) ga
            dihubungkan ke data Murid tertentu, jadi belum ada data
            pembayaran contoh buat ditampilkan. Murid asli yang login
            bakal liat pembayaran mereka sendiri di sini.
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
            Akun kamu belum dihubungkan ke data Murid. Minta Owner buat
            hubungkan lewat halaman Accounts.
          </div>
        )}
      </div>
    );
  }

  const { data: student } = await supabase
    .from("students")
    .select("sessions_used, sessions_per_package, package_price, payment_status")
    .eq("id", profile.student_id)
    .maybeSingle();

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, payment_date, method, status")
    .eq("student_id", profile.student_id)
    .order("payment_date", { ascending: false });

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-6">
        Payment Saya
      </h1>

      {student && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-bmos-border rounded-2xl p-5">
            <p className="text-xs text-bmos-text-light mb-1">Status</p>
            <p className="text-lg font-bold text-bmos-text">
              {student.payment_status}
            </p>
          </div>
          <div className="bg-white border border-bmos-border rounded-2xl p-5">
            <p className="text-xs text-bmos-text-light mb-1">Sesi Terpakai</p>
            <p className="text-lg font-bold text-bmos-text">
              {student.sessions_used ?? 0} / {student.sessions_per_package ?? 0}
            </p>
          </div>
          <div className="bg-white border border-bmos-border rounded-2xl p-5">
            <p className="text-xs text-bmos-text-light mb-1">Harga Paket</p>
            <p className="text-lg font-bold text-bmos-text">
              {formatCurrency(student.package_price ?? 0)}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        {(payments ?? []).length === 0 ? (
          <div className="text-center py-14">
            <p className="text-3xl mb-2">💳</p>
            <p className="text-bmos-text font-semibold">
              Belum ada riwayat pembayaran
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-bmos-text-light border-b border-bmos-border">
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 font-medium">Jumlah</th>
                <th className="px-5 py-3 font-medium">Metode</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-bmos-border last:border-0"
                >
                  <td className="px-5 py-3 text-bmos-text">
                    {new Date(p.payment_date).toLocaleDateString("id-ID")}
                  </td>
                  <td className="px-5 py-3 font-semibold text-bmos-text">
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="px-5 py-3 text-bmos-text-light">
                    {p.method || "-"}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-semibold text-bmos-primary">
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
