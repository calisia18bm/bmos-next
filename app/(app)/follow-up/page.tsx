import { createClient } from "@/lib/supabase/server";
import AddFollowUpButton from "./AddFollowUpButton";
import FollowUpCheckbox from "./FollowUpCheckbox";

export default async function FollowUpPage() {
  const supabase = await createClient();

  const [{ data: followUps }, { data: leads }] = await Promise.all([
    supabase
      .from("follow_ups")
      .select("*, leads(name)")
      .order("due_date", { ascending: true }),
    supabase.from("leads").select("id, name"),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            CRM
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text">
            Follow Up
          </h1>
          <p className="text-bmos-text-light text-sm mt-1">
            Daftar tugas follow up ke calon murid.
          </p>
        </div>
        <AddFollowUpButton leads={leads ?? []} />
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-bmos-text-light border-b border-bmos-border">
              <th className="px-5 py-3 font-medium w-10"></th>
              <th className="px-5 py-3 font-medium">Catatan</th>
              <th className="px-5 py-3 font-medium">Lead Terkait</th>
              <th className="px-5 py-3 font-medium">Tanggal</th>
            </tr>
          </thead>
          <tbody>
            {(followUps ?? []).map((f) => {
              const isOverdue =
                !f.completed && f.due_date < today;
              return (
                <tr
                  key={f.id}
                  className={`border-b border-bmos-border last:border-0 ${
                    f.completed ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-5 py-3">
                    <FollowUpCheckbox id={f.id} completed={f.completed} />
                  </td>
                  <td className="px-5 py-3">
                    <p
                      className={`text-bmos-text ${
                        f.completed ? "line-through" : ""
                      }`}
                    >
                      {f.note}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-bmos-text">
                    {f.leads?.name || "-"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        isOverdue
                          ? "text-red-600 font-semibold"
                          : "text-bmos-text"
                      }
                    >
                      {new Date(f.due_date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {isOverdue && " (Terlambat)"}
                    </span>
                  </td>
                </tr>
              );
            })}

            {(!followUps || followUps.length === 0) && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-10 text-center text-bmos-text-light"
                >
                  Belum ada follow up.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
