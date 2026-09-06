import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTodayChallenge } from "./actions";
import ChallengeStudent from "./ChallengeStudent";

export const dynamic = "force-dynamic";

export default async function ChallengePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.roles.includes("STUDENT") || !profile.student_id) {
    redirect("/");
  }

  const data = await getTodayChallenge();

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
        />
      )}
    </div>
  );
}
