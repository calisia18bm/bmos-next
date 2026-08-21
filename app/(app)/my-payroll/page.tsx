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

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  APPROVED: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
};

// Versi Payroll khusus Laoshi -- read-only, cuma liat gaji dia sendiri.
// Bikin/setujui/tandai-lunas payroll tetap cuma lewat halaman Payroll
// punya Owner/Admin.
export default async function MyPayrollPage() {
  const profile = await getCurrentProfile();
  const isStaff =
    profile?.roles?.includes("OWNER") || profile?.roles?.includes("ADMIN");
  const isTeacher = profile?.roles?.includes("TEACHER");

  // Owner/Admin boleh buka buat preview tampilan Laoshi -- sebelumnya
  // ke-redirect balik ke Home karena role-nya bukan TEACHER.
  if (!profile || (!isTeacher && !isStaff)) {
    redirect("/");
  }

  if (!profile.teacher_id) {
    return (
      <div>
        <h1 className="text-3xl font-extrabold text-bmos-text mb-4">
          Payroll Saya
        </h1>
        {isStaff ? (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
            👁️ Preview tampilan Laoshi -- akun kamu (Owner/Admin) ga
            dihubungkan ke data Laoshi tertentu, jadi belum ada data
            payroll contoh buat ditampilkan. Laoshi asli yang login bakal
            liat gaji mereka sendiri di sini.
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
            Akun kamu belum dihubungkan ke data Laoshi. Minta Owner buat
            hubungkan lewat halaman Accounts.
          </div>
        )}
      </div>
    );
  }

  const supabase = await createClient();
  const { data: payroll } = await supabase
    .from("payroll")
    .select("*")
    .eq("teacher_id", profile.teacher_id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-6">
        Payroll Saya
      </h1>

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-bmos-text-light border-b border-bmos-border">
              <th className="px-5 py-3 font-medium">Periode</th>
              <th className="px-5 py-3 font-medium">Sesi</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(payroll ?? []).map((p) => (
              <tr key={p.id} className="border-b border-bmos-border last:border-0">
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
                <td className="px-5 py-3 text-bmos-text">{p.sessions_count}x</td>
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
              </tr>
            ))}

            {(!payroll || payroll.length === 0) && (
              <tr>
                <td
                  colSpan={4}
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
