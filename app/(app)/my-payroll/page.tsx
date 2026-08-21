import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import OwnerPreviewPicker from "@/components/OwnerPreviewPicker";

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
//
// Cuma OWNER (BUKAN Admin) yang boleh preview & pilih Laoshi tertentu di
// sini -- ini data gaji personal, sengaja ga dikasih ke Admin.
export default async function MyPayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ teacherId?: string }>;
}) {
  const { teacherId: pickedTeacherId } = await searchParams;
  const profile = await getCurrentProfile();
  const isOwner = profile?.roles?.includes("OWNER") ?? false;
  const isTeacher = profile?.roles?.includes("TEACHER") ?? false;

  if (!profile || (!isTeacher && !isOwner)) {
    redirect("/");
  }

  const supabase = await createClient();

  const effectiveTeacherId = isTeacher ? profile.teacher_id : pickedTeacherId || null;

  let teacherOptions: { id: string; name: string; code?: string | null }[] = [];
  if (isOwner) {
    const { data } = await supabase
      .from("teachers")
      .select("id, name, teacher_code")
      .order("name");
    teacherOptions = (data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      code: t.teacher_code,
    }));
  }

  if (!effectiveTeacherId) {
    return (
      <div>
        <h1 className="text-3xl font-extrabold text-bmos-text mb-4">
          My Payroll
        </h1>
        {isOwner ? (
          <>
            <OwnerPreviewPicker
              paramKey="teacherId"
              options={teacherOptions}
              selectedId={null}
              roleLabel="Laoshi"
            />
            <p className="text-sm text-bmos-text-light">
              Pilih Laoshi dulu buat liat data payroll aslinya.
            </p>
          </>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
            Akun kamu belum dihubungkan ke data Laoshi. Minta Owner buat
            hubungkan lewat halaman Accounts.
          </div>
        )}
      </div>
    );
  }

  const { data: payroll } = await supabase
    .from("payroll")
    .select("*")
    .eq("teacher_id", effectiveTeacherId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-6">
        My Payroll
      </h1>

      {isOwner && (
        <OwnerPreviewPicker
          paramKey="teacherId"
          options={teacherOptions}
          selectedId={effectiveTeacherId}
          roleLabel="Laoshi"
        />
      )}

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
