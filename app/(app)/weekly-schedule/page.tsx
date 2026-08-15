import { createClient } from "@/lib/supabase/server";
import WeekNavigator from "./WeekNavigator";
import GenerateSessionsButton from "./GenerateSessionsButton";

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const STATUS_STYLE: Record<string, string> = {
  UPCOMING: "bg-blue-50 text-blue-700",
  FINISHED: "bg-green-50 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
  RESCHEDULED: "bg-yellow-50 text-yellow-700",
};

function getMondayOfWeek(offsetWeeks: number): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatDateID(date: Date) {
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default async function WeeklySchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const offset = Number(params.week || "0");

  const monday = getMondayOfWeek(offset);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const mondayStr = monday.toISOString().slice(0, 10);
  const sundayStr = sunday.toISOString().slice(0, 10);

  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .gte("session_date", mondayStr)
    .lte("session_date", sundayStr)
    .order("start_time");

  const byDay: Record<string, typeof sessions> = {};
  DAYS.forEach((d) => (byDay[d] = []));

  (sessions ?? []).forEach((s) => {
    const date = new Date(s.session_date + "T00:00:00");
    const jsDay = date.getDay();
    const dayName = DAYS[jsDay === 0 ? 6 : jsDay - 1];
    byDay[dayName]!.push(s);
  });

  const weekLabel = offset === 0 ? "Minggu Ini" : offset > 0 ? `${offset} Minggu Lagi` : `${Math.abs(offset)} Minggu Lalu`;
  const dateRangeLabel = `${formatDateID(monday)} - ${formatDateID(sunday)}`;

  const totalSessions = (sessions ?? []).length;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Schedule
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text">
            Weekly Schedule
          </h1>
          <p className="text-bmos-text-light text-sm mt-1">
            Lihat dan kelola seluruh jadwal kelas dalam satu minggu.
          </p>
        </div>
        <GenerateSessionsButton />
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl p-5 mb-6 flex items-center justify-between flex-wrap gap-4">
        <WeekNavigator weekLabel={weekLabel} dateRangeLabel={dateRangeLabel} />
        <p className="text-sm text-bmos-text-light">
          {totalSessions} sesi minggu ini
        </p>
      </div>

      {totalSessions === 0 ? (
        <div className="bg-white border border-bmos-border rounded-2xl p-10 text-center text-bmos-text-light">
          Belum ada sesi di minggu ini. Klik &quot;Generate Sessions&quot; di
          atas buat bikin jadwal dari pola kelas berulang.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {DAYS.map((day, i) => {
            const dayDate = new Date(monday);
            dayDate.setDate(dayDate.getDate() + i);

            return (
              <div
                key={day}
                className="bg-white border border-bmos-border rounded-2xl overflow-hidden"
              >
                <div className="bg-bmos-primary-soft px-4 py-2.5">
                  <p className="text-xs font-bold text-bmos-primary uppercase tracking-wide">
                    {day}
                  </p>
                  <p className="text-[11px] text-bmos-text-light">
                    {formatDateID(dayDate)}
                  </p>
                </div>
                <div className="p-3 space-y-2 min-h-[100px]">
                  {(byDay[day] ?? []).map((s) => (
                    <div
                      key={s.id}
                      className="bg-bmos-primary-soft/40 border border-bmos-border rounded-xl p-3"
                    >
                      <p className="text-sm font-semibold text-bmos-text">
                        {s.class_name}
                      </p>
                      <p className="text-xs text-bmos-text-light mt-0.5">
                        {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                      </p>
                      <p className="text-xs text-bmos-text-light">
                        {s.teacher_actual || s.teacher_planned || "-"}
                      </p>
                      <span
                        className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          STATUS_STYLE[s.status] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                  ))}

                  {(byDay[day] ?? []).length === 0 && (
                    <p className="text-xs text-bmos-text-light text-center py-4">
                      -
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
