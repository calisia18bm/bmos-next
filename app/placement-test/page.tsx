import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PlacementTestQuiz from "./PlacementTestQuiz";

export const dynamic = "force-dynamic";

// Halaman PUBLIK (di luar folder (app), jadi ga ke-gate login) -- calon
// murid/murid bisa langsung isi placement test dari website tanpa perlu
// akun BMOS dulu. Soalnya diatur Owner/Admin dari halaman
// /placement-test-manage (di dalam (app), butuh login Owner/Admin).
export default async function PlacementTestPage() {
  const supabase = await createClient();
  const { data: questions } = await supabase
    .from("placement_test_questions")
    .select("id, question_text, options")
    .order("order_index", { ascending: true });

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="w-full max-w-lg mx-auto">
        <Link
          href="/"
          className="text-xs font-semibold text-bmos-text-light hover:text-bmos-primary mb-4 inline-block"
        >
          ← Kembali ke BMOS
        </Link>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-bmos-text">Placement Test</h1>
          <p className="text-bmos-text-light text-sm mt-1">BM Mandarin</p>
        </div>
        <PlacementTestQuiz
          questions={(questions ?? []).map((q) => ({
            id: q.id,
            question_text: q.question_text,
            options: (q.options as string[]) ?? [],
          }))}
        />
      </div>
    </div>
  );
}
