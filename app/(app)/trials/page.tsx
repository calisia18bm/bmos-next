import { createClient } from "@/lib/supabase/server";
import AddTrialButton from "./AddTrialButton";
import TrialRowActions from "./TrialRowActions";

export default async function TrialsPage() {
  const supabase = await createClient();

  const [{ data: trials }, { data: classes }] = await Promise.all([
    supabase
      .from("trials")
      .select("*")
      .order("scheduled_date", { ascending: false }),
    supabase.from("classes").select("id, name").eq("active", true),
  ]);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            CRM
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text">Trials</h1>
          <p className="text-bmos-text-light text-sm mt-1">
            Kelola jadwal trial class dan konversi jadi murid.
          </p>
        </div>
        <AddTrialButton classes={classes ?? []} />
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-bmos-text-light border-b border-bmos-border">
              <th className="px-5 py-3 font-medium">Nama</th>
              <th className="px-5 py-3 font-medium">Tanggal Trial</th>
              <th className="px-5 py-3 font-medium">Kontak</th>
              <th className="px-5 py-3 font-medium">Status / Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(trials ?? []).map((t) => (
              <tr key={t.id} className="border-b border-bmos-border last:border-0">
                <td className="px-5 py-3">
                  <p className="font-semibold text-bmos-text">{t.name}</p>
                  <p className="text-xs text-bmos-text-light">
                    {t.trial_code}
                  </p>
                </td>
                <td className="px-5 py-3 text-bmos-text">
                  {new Date(t.scheduled_date).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-5 py-3 text-bmos-text">{t.phone || "-"}</td>
                <td className="px-5 py-3">
                  <TrialRowActions id={t.id} status={t.status} />
                </td>
              </tr>
            ))}

            {(!trials || trials.length === 0) && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-10 text-center text-bmos-text-light"
                >
                  Belum ada jadwal trial.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
