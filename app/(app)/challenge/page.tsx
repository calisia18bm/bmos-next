import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTodayChallenge, getPreviewChallenge } from "./actions";
import ChallengeStudent from "./ChallengeStudent";

export const dynamic = "force-dynamic";

// Pola sama kayak halaman PR/Materi -- Owner/Admin yang buka menu ini
// (tapi akunnya sendiri ga punya role Murid) otomatis dikasih tampilan
// PREVIEW (interaksi dimatiin), bukan di-redirect/kosong.
export default async function ChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { level: previewLevel } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isStaff = profile.roles.includes("OWNER") || profile.roles.includes("ADMIN");
  const isRealStudent = profile.roles.includes("STUDENT") && !!profile.student_id;

  if (!isRealStudent && !isStaff) {
    redirect("/");
  }

  const data = isRealStudent
    ? await getTodayChallenge()
    : await getPreviewChallenge((previewLevel === "MENENGAH" ? "MENENGAH" : "DASAR") as "DASAR" | "MENENGAH");

  return (
    <div>
      <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
        Murid
      </p>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-1">
        Challenge 30 Hari
      </h1>
      <p className="text-bmos-text-light text-sm mb-6">
        10 kosakata baru tiap hari, hafalin lewat kartu, terus test 10/10 buat
        dapet cap harinya.
      </p>

      {!isRealStudent && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4 text-sm text-blue-800">
          👁️ Preview tampilan Murid (level {previewLevel === "MENENGAH" ? "Menengah" : "Dasar"}) --
          akun kamu bukan akun Murid, jadi progress/cap di sini ga beneran
          kesimpen. Ganti{" "}
          <span className="font-mono text-xs bg-white/60 px-1.5 py-0.5 rounded">?level=MENENGAH</span>{" "}
          di URL buat liat level satunya.
        </div>
      )}

      {!data.success ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
          {data.message}
        </div>
      ) : (
        <ChallengeStudent
          studentName={data.student?.name ?? profile.full_name ?? "Murid"}
          level={data.student?.level ?? "DASAR"}
          progress={data.progress!}
          alreadyDoneToday={!!data.alreadyDoneToday}
          words={data.words ?? []}
          frozenDay={data.frozenDay ?? null}
          frozenDayDeadline={data.frozenDayDeadline ?? null}
          frozenWords={data.frozenWords ?? []}
          disabled={!isRealStudent}
        />
      )}
    </div>
  );
}
