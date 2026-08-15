import { createClient } from "@/lib/supabase/server";
import AddStudentButton from "./AddStudentButton";

export default async function StudentsPage() {
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("students")
    .select("*")
    .order("created_at", { ascending: false });

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
        <AddStudentButton />
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
              <tr key={s.id} className="border-b border-bmos-border last:border-0">
                <td className="px-5 py-3">
                  <p className="font-semibold text-bmos-text">{s.name}</p>
                  <p className="text-xs text-bmos-text-light">
                    {s.student_code}
                  </p>
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
