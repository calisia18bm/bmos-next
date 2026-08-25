import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import QuestionManage from "./QuestionManage";

export const dynamic = "force-dynamic";

// Owner/Admin doang -- atur soal placement test & pantau hasilnya.
// Soalnya sendiri diisi calon murid/murid dari halaman publik
// /placement-test (di luar (app), ga perlu login).
export default async function PlacementTestManagePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isStaff = profile.roles.includes("OWNER") || profile.roles.includes("ADMIN");
  if (!isStaff) redirect("/");

  const supabase = await createClient();
  const [{ data: questions }, { data: results }] = await Promise.all([
    supabase
      .from("placement_test_questions")
      .select("id, question_text, options, correct_index, order_index")
      .order("order_index", { ascending: true }),
    supabase
      .from("placement_test_results")
      .select("id, name, phone, email, score, total_questions, level_suggestion, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div>
      <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
        Admin
      </p>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-1">Placement Test</h1>
      <p className="text-bmos-text-light text-sm mb-6">
        Atur soal placement test (bisa diakses siapa aja di{" "}
        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
          /placement-test
        </span>
        ) & pantau hasilnya di sini.
      </p>

      <div className="space-y-8">
        <QuestionManage
          questions={(questions ?? []).map((q) => ({
            ...q,
            options: (q.options as string[]) ?? [],
          }))}
        />

        <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-bmos-border">
            <h2 className="font-bold text-bmos-text text-lg">
              Hasil Terbaru ({(results ?? []).length})
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-bmos-text-light border-b border-bmos-border">
                <th className="px-5 py-3 font-medium">Nama</th>
                <th className="px-5 py-3 font-medium">Kontak</th>
                <th className="px-5 py-3 font-medium">Skor</th>
                <th className="px-5 py-3 font-medium">Saran Level</th>
                <th className="px-5 py-3 font-medium">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {(results ?? []).map((r) => (
                <tr key={r.id} className="border-b border-bmos-border last:border-0">
                  <td className="px-5 py-3 font-semibold text-bmos-text">{r.name}</td>
                  <td className="px-5 py-3 text-bmos-text-light">
                    {r.phone || r.email || "-"}
                  </td>
                  <td className="px-5 py-3 text-bmos-text">
                    {r.score}/{r.total_questions}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-bmos-primary-soft text-bmos-primary">
                      {r.level_suggestion}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-bmos-text-light">
                    {new Date(r.created_at).toLocaleString("id-ID")}
                  </td>
                </tr>
              ))}
              {(!results || results.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-bmos-text-light">
                    Belum ada hasil placement test.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
