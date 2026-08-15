import { createClient } from "@/lib/supabase/server";
import AddLeadButton from "./AddLeadButton";
import LeadStatusSelect from "./LeadStatusSelect";

export default async function LeadsPage() {
  const supabase = await createClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            CRM
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text">Leads</h1>
          <p className="text-bmos-text-light text-sm mt-1">
            Kelola calon murid dari awal kontak sampai daftar.
          </p>
        </div>
        <AddLeadButton />
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-bmos-text-light border-b border-bmos-border">
              <th className="px-5 py-3 font-medium">Nama</th>
              <th className="px-5 py-3 font-medium">Kontak</th>
              <th className="px-5 py-3 font-medium">Sumber</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((l) => (
              <tr key={l.id} className="border-b border-bmos-border last:border-0">
                <td className="px-5 py-3">
                  <p className="font-semibold text-bmos-text">{l.name}</p>
                  <p className="text-xs text-bmos-text-light">
                    {l.lead_code}
                  </p>
                </td>
                <td className="px-5 py-3 text-bmos-text">{l.phone || "-"}</td>
                <td className="px-5 py-3 text-bmos-text">
                  {l.source || "-"}
                </td>
                <td className="px-5 py-3">
                  <LeadStatusSelect id={l.id} status={l.status} />
                </td>
              </tr>
            ))}

            {(!leads || leads.length === 0) && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-10 text-center text-bmos-text-light"
                >
                  Belum ada data lead.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
