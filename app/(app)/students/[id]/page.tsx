import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import EditStudentButton from "./EditStudentButton";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!student) notFound();

  const [{ data: payments }, { data: attendance }, { data: classesList }] = await Promise.all([
    supabase
      .from("payments")
      .select("*")
      .eq("student_id", id)
      .order("payment_date", { ascending: false }),
    supabase
      .from("attendance")
      .select("*")
      .eq("student_id", id)
      .order("attendance_date", { ascending: false }),
    supabase.from("classes").select("id, name, teacher_name").eq("active", true),
  ]);

  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const sessionsPaid = student.package_price
    ? Math.floor(totalPaid / (student.package_price / student.sessions_per_package))
    : 0;

  const hadirCount = (attendance ?? []).filter((a) => a.status === "HADIR").length;
  const izinCount = (attendance ?? []).filter((a) => a.status === "IZIN").length;
  const alphaCount = (attendance ?? []).filter((a) => a.status === "ALPHA").length;
  const lastAttended = (attendance ?? [])[0]?.attendance_date;

  return (
    <div>
      <Link
        href="/students"
        className="text-sm text-bmos-text-light hover:text-bmos-text mb-4 inline-block"
      >
        ← Kembali ke Students
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            {student.student_code}
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text">
            {student.name}
          </h1>
          <p className="text-bmos-text-light text-sm mt-1">
            {student.class_name || "Belum ada kelas"} · {student.teacher_name || "-"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold ${
              student.status === "ACTIVE"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {student.status}
          </span>
          <EditStudentButton student={student} classes={classesList ?? []} />
        </div>
      </div>

      {/* Profil lengkap */}
      <div className="bg-white border border-bmos-border rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-bmos-text mb-4">Profil Murid</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-bmos-text-light">No. HP</p>
            <p className="text-sm font-semibold text-bmos-text mt-0.5">
              {student.phone || "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-bmos-text-light">Kelas</p>
            <p className="text-sm font-semibold text-bmos-text mt-0.5">
              {student.class_name || "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-bmos-text-light">Laoshi</p>
            <p className="text-sm font-semibold text-bmos-text mt-0.5">
              {student.teacher_name || "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-bmos-text-light">Terdaftar Sejak</p>
            <p className="text-sm font-semibold text-bmos-text mt-0.5">
              {formatDate(student.created_at)}
            </p>
          </div>
          <div>
            <p className="text-xs text-bmos-text-light">Harga Paket</p>
            <p className="text-sm font-semibold text-bmos-text mt-0.5">
              {formatCurrency(student.package_price || 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-bmos-text-light">Sesi per Paket</p>
            <p className="text-sm font-semibold text-bmos-text mt-0.5">
              {student.sessions_per_package || "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-bmos-text-light">Status Pembayaran</p>
            <p className="text-sm font-semibold text-bmos-text mt-0.5">
              {student.payment_status || "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-bmos-text-light">Terakhir Hadir</p>
            <p className="text-sm font-semibold text-bmos-text mt-0.5">
              {lastAttended ? formatDate(lastAttended) : "Belum pernah"}
            </p>
          </div>
        </div>
        {student.notes && (
          <div className="mt-4 pt-4 border-t border-bmos-border">
            <p className="text-xs text-bmos-text-light mb-1">Catatan</p>
            <p className="text-sm text-bmos-text">{student.notes}</p>
          </div>
        )}
      </div>

      {/* Ringkasan angka */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <p className="text-sm text-bmos-text-light">Total Dibayar</p>
          <p className="text-xl font-extrabold text-green-700 mt-1">
            {formatCurrency(totalPaid)}
          </p>
        </div>
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <p className="text-sm text-bmos-text-light">Sesi Terbayar (est.)</p>
          <p className="text-xl font-extrabold text-bmos-text mt-1">
            {sessionsPaid}
          </p>
        </div>
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <p className="text-sm text-bmos-text-light">Total Hadir</p>
          <p className="text-xl font-extrabold text-bmos-text mt-1">
            {hadirCount}
          </p>
        </div>
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <p className="text-sm text-bmos-text-light">Izin / Alpha</p>
          <p className="text-xl font-extrabold text-bmos-text mt-1">
            {izinCount} / {alphaCount}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Riwayat pembayaran */}
        <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-bmos-border">
            <h2 className="font-bold text-bmos-text">Riwayat Pembayaran</h2>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {(payments ?? []).map((p) => (
                  <tr key={p.id} className="border-b border-bmos-border last:border-0">
                    <td className="px-5 py-2.5 text-bmos-text">
                      {formatDate(p.payment_date)}
                    </td>
                    <td className="px-5 py-2.5 text-bmos-text-light">
                      {p.method}
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold text-bmos-text">
                      {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
                {(!payments || payments.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-bmos-text-light">
                      Belum ada pembayaran.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Riwayat absensi */}
        <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-bmos-border">
            <h2 className="font-bold text-bmos-text">Riwayat Absensi</h2>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {(attendance ?? []).map((a) => (
                  <tr key={a.id} className="border-b border-bmos-border last:border-0">
                    <td className="px-5 py-2.5 text-bmos-text">
                      {formatDate(a.attendance_date)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          a.status === "HADIR"
                            ? "bg-green-100 text-green-700"
                            : a.status === "IZIN"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!attendance || attendance.length === 0) && (
                  <tr>
                    <td colSpan={2} className="px-5 py-8 text-center text-bmos-text-light">
                      Belum ada catatan absensi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
