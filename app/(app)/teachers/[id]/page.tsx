import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import EditTeacherButton from "../EditTeacherButton";

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

const PAYROLL_STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  APPROVED: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
};

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: teacher } = await supabase
    .from("teachers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!teacher) notFound();

  const [{ data: classes }, { data: payroll }] = await Promise.all([
    supabase
      .from("classes")
      .select("*")
      .eq("teacher_id", id)
      .order("active", { ascending: false }),
    supabase
      .from("payroll")
      .select("*")
      .eq("teacher_id", id)
      .order("period_start", { ascending: false }),
  ]);

  const classIds = (classes ?? []).map((c) => c.id);
  const { data: students } =
    classIds.length > 0
      ? await supabase
          .from("students")
          .select("id, class_id, status")
          .in("class_id", classIds)
      : { data: [] as { id: string; class_id: string; status: string }[] };

  const activeClasses = (classes ?? []).filter((c) => c.active);
  const activeStudentCount = (students ?? []).filter(
    (s) => s.status === "ACTIVE"
  ).length;

  const totalPaid = (payroll ?? [])
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + Number(p.total_amount), 0);
  const totalSessions = (payroll ?? []).reduce(
    (s, p) => s + Number(p.sessions_count || 0),
    0
  );

  return (
    <div>
      <Link
        href="/teachers"
        className="text-sm text-bmos-text-light hover:text-bmos-text mb-4 inline-block"
      >
        ← Kembali ke Teachers
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            {teacher.teacher_code}
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text">
            {teacher.name}
          </h1>
          <p className="text-bmos-text-light text-sm mt-1">
            {activeClasses.length} kelas aktif
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold ${
              teacher.active
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {teacher.active ? "AKTIF" : "NON-AKTIF"}
          </span>
          <EditTeacherButton teacher={teacher} />
        </div>
      </div>

      {/* Profil lengkap */}
      <div className="bg-white border border-bmos-border rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-bmos-text mb-4">Profil Laoshi</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-bmos-text-light">No. HP</p>
            <p className="text-sm font-semibold text-bmos-text mt-0.5">
              {teacher.phone || "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-bmos-text-light">Rate per Sesi</p>
            <p className="text-sm font-semibold text-bmos-text mt-0.5">
              {formatCurrency(teacher.rate_per_session || 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-bmos-text-light">Sesi per Payout</p>
            <p className="text-sm font-semibold text-bmos-text mt-0.5">
              {teacher.sessions_per_payout || "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-bmos-text-light">Terdaftar Sejak</p>
            <p className="text-sm font-semibold text-bmos-text mt-0.5">
              {teacher.created_at ? formatDate(teacher.created_at) : "-"}
            </p>
          </div>
        </div>
      </div>

      {/* Ringkasan angka */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <p className="text-sm text-bmos-text-light">Kelas Aktif</p>
          <p className="text-xl font-extrabold text-bmos-text mt-1">
            {activeClasses.length}
          </p>
        </div>
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <p className="text-sm text-bmos-text-light">Total Murid Aktif</p>
          <p className="text-xl font-extrabold text-bmos-text mt-1">
            {activeStudentCount}
          </p>
        </div>
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <p className="text-sm text-bmos-text-light">Total Sesi Dibayar</p>
          <p className="text-xl font-extrabold text-bmos-text mt-1">
            {totalSessions}
          </p>
        </div>
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <p className="text-sm text-bmos-text-light">Total Gaji Dibayar</p>
          <p className="text-xl font-extrabold text-green-700 mt-1">
            {formatCurrency(totalPaid)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kelas yang diajar */}
        <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-bmos-border">
            <h2 className="font-bold text-bmos-text">Kelas yang Diajar</h2>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {(classes ?? []).map((c) => {
                  const studentCount = (students ?? []).filter(
                    (s) => s.class_id === c.id && s.status === "ACTIVE"
                  ).length;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-bmos-border last:border-0"
                    >
                      <td className="px-5 py-2.5">
                        <p className="font-semibold text-bmos-text">
                          {c.name}
                        </p>
                        <p className="text-xs text-bmos-text-light">
                          {c.class_code} · {c.day_of_week || "-"}{" "}
                          {c.start_time ? `${c.start_time.slice(0, 5)}` : ""}
                        </p>
                      </td>
                      <td className="px-5 py-2.5 text-bmos-text-light text-xs text-right">
                        {studentCount} murid
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            c.active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {c.active ? "Aktif" : "Non-Aktif"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {(!classes || classes.length === 0) && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-8 text-center text-bmos-text-light"
                    >
                      Belum ada kelas yang diajar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Riwayat payroll */}
        <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-bmos-border">
            <h2 className="font-bold text-bmos-text">Riwayat Payroll</h2>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {(payroll ?? []).map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-bmos-border last:border-0"
                  >
                    <td className="px-5 py-2.5">
                      <p className="text-bmos-text">
                        {formatDate(p.period_start)} —{" "}
                        {formatDate(p.period_end)}
                      </p>
                      <p className="text-xs text-bmos-text-light">
                        {p.sessions_count}x sesi
                      </p>
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold text-bmos-text">
                      {formatCurrency(p.total_amount)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          PAYROLL_STATUS_STYLE[p.status] ||
                          "bg-gray-100 text-gray-600"
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
                      colSpan={3}
                      className="px-5 py-8 text-center text-bmos-text-light"
                    >
                      Belum ada riwayat payroll.
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
