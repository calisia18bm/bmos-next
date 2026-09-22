import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AddStudentButton from "./AddStudentButton";

export const dynamic = "force-dynamic";

// Default-nya CUMA nampilin Murid yang statusnya ACTIVE (bukan semua
// murid dari awal berdiri termasuk yang udah lulus/nonaktif) -- daftar
// Murid Non-Aktif bakal terus numpuk seiring waktu, jadi kalau ga
// dibatesin, halaman ini bakal makin berat kebuka. Klik "Tampilkan
// Semua" buat lihat termasuk yang Non-Aktif kalau perlu.
export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isStaff = profile.roles.includes("OWNER") || profile.roles.includes("ADMIN");
  if (!isStaff) redirect("/");

  const { all } = await searchParams;
  const showAll = all === "1";

  const supabase = await createClient();

  const studentsQuery = supabase
    .from("students")
    .select("*")
    .order("created_at", { ascending: false });
  if (!showAll) {
    studentsQuery.eq("status", "ACTIVE");
  }

  const [{ data: students }, { data: classesList }] = await Promise.all([
    studentsQuery,
    supabase
      .from("classes")
      .select("id, name, teacher_name")
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Master Data
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text">Students</h1>
          <p className="text-bmos-text-light text-sm mt-1">
            Kelola data murid, kelas, dan status pembayaran.
          </p>
        </div>
        <AddStudentButton classes={classesList ?? []} />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Link
          href={showAll ? "/students" : "/students?all=1"}
          className="text-xs font-semibold text-bmos-primary hover:underline"
        >
          {showAll
            ? "Tampilkan yang Aktif saja"
            : "Tampilkan Semua (termasuk Non-Aktif)"}
        </Link>
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-bmos-text-light border-b border-bmos-border">
              <th className="px-5 py-3 font-medium">Murid</th>
              <th className="px-5 py-3 font-medium">Kelas</th>
              <th className="px-5 py-3 font-medium">Kontak</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(students ?? []).map((s) => (
              <tr
                key={s.id}
                className="border-b border-bmos-border last:border-0 hover:bg-bmos-primary-soft/30 cursor-pointer"
              >
                <td className="px-5 py-3">
                  <Link href={`/students/${s.id}`} className="block">
                    <p className="font-semibold text-bmos-text">{s.name}</p>
                    <p className="text-xs text-bmos-text-light">
                      {s.student_code}
                    </p>
                  </Link>
                </td>
                <td className="px-5 py-3 text-bmos-text">
                  {s.class_name || "-"}
                </td>
                <td className="px-5 py-3 text-bmos-text">{s.phone || "-"}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                      s.status === "ACTIVE"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}

            {(!students || students.length === 0) && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-10 text-center text-bmos-text-light"
                >
                  Belum ada data murid. Klik &quot;Tambah Murid&quot; untuk
                  mulai.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
