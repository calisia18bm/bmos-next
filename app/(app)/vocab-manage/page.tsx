import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listVocabWords, getChallengeLaggards } from "../challenge/actions";
import VocabManage from "./VocabManage";

export const dynamic = "force-dynamic";

// Owner/Admin doang -- kelola bank kosakata Challenge 30 Hari & pantau
// murid mana yang lagi kepepet/butuh reminder.
export default async function VocabManagePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isStaff = profile.roles.includes("OWNER") || profile.roles.includes("ADMIN");
  if (!isStaff) redirect("/");

  const [dasarRes, menengahRes, laggardsRes] = await Promise.all([
    listVocabWords("DASAR"),
    listVocabWords("MENENGAH"),
    getChallengeLaggards(),
  ]);

  const laggards = laggardsRes.success ? laggardsRes.laggards ?? [] : [];

  return (
    <div>
      <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
        Admin
      </p>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-1">
        Challenge 30 Hari & Kosakata
      </h1>
      <p className="text-bmos-text-light text-sm mb-6">
        Kelola bank kosakata per level, dan pantau murid yang belum ngerjain
        challenge hari ini.
      </p>

      <div className="space-y-8">
        {laggards.length > 0 && (
          <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-bmos-border">
              <h2 className="font-bold text-bmos-text text-lg">
                Perlu Diperhatikan ({laggards.length})
              </h2>
            </div>
            <div className="divide-y divide-bmos-border">
              {laggards.map((l) => (
                <div key={l.studentId} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-bmos-text">
                      {l.name} <span className="text-xs font-normal text-bmos-text-light">({l.level}, Hari {l.currentDay})</span>
                    </p>
                    <p className="text-xs text-bmos-text-light">{l.reminderMessage}</p>
                  </div>
                  <span
                    className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full ${
                      l.status === "TERANCAM_RESET"
                        ? "bg-red-100 text-red-700"
                        : l.status === "PAKE_FREEZE"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {l.status === "TERANCAM_RESET"
                      ? "Terancam reset"
                      : l.status === "PAKE_FREEZE"
                      ? "Pakai freeze"
                      : "Belum mulai hari ini"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <VocabManage
          dasarWords={dasarRes.success ? (dasarRes.words as never) : []}
          menengahWords={menengahRes.success ? (menengahRes.words as never) : []}
        />
      </div>
    </div>
  );
}
