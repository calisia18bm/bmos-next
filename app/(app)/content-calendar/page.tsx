import { createClient } from "@/lib/supabase/server";
import AddContentButton from "./AddContentButton";
import ContentStatusSelect from "./ContentStatusSelect";

export default async function ContentCalendarPage() {
  const supabase = await createClient();

  const { data: content } = await supabase
    .from("content_calendar")
    .select("*")
    .order("scheduled_date", { ascending: true });

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Schedule
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text">
            Content Calendar
          </h1>
          <p className="text-bmos-text-light text-sm mt-1">
            Jadwal posting media sosial BM Masterclass.
          </p>
        </div>
        <AddContentButton />
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-bmos-text-light border-b border-bmos-border">
              <th className="px-5 py-3 font-medium">Konten</th>
              <th className="px-5 py-3 font-medium">Platform</th>
              <th className="px-5 py-3 font-medium">Tanggal</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(content ?? []).map((c) => (
              <tr key={c.id} className="border-b border-bmos-border last:border-0">
                <td className="px-5 py-3">
                  <p className="font-semibold text-bmos-text">{c.title}</p>
                  {c.notes && (
                    <p className="text-xs text-bmos-text-light">
                      {c.notes}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3 text-bmos-text">{c.platform}</td>
                <td className="px-5 py-3 text-bmos-text">
                  {new Date(c.scheduled_date).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-5 py-3">
                  <ContentStatusSelect id={c.id} status={c.status} />
                </td>
              </tr>
            ))}

            {(!content || content.length === 0) && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-10 text-center text-bmos-text-light"
                >
                  Belum ada konten dijadwalkan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
