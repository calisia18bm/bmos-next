import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import OwnerPreviewPicker from "@/components/OwnerPreviewPicker";
import WeekNavigator from "@/components/WeekNavigator";

export const dynamic = "force-dynamic";

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

// Cuma OWNER (BUKAN Admin) yang boleh preview & pilih Murid tertentu di
// sini -- ini data personal (jadwal) milik Murid, sengaja ga dikasih ke
// Admin. Murid asli tetap cuma bisa liat jadwal dirinya sendiri.
//
// Tampilannya dibikin sama kayak Weekly Schedule punya Owner (grid 7
// hari per minggu, bisa geser minggu), bukan tabel list lagi.
export default async function MyClassStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string; week?: string }>;
}) {
  const { studentId: pickedStudentId, week } = await searchParams;
  const profile = await getCurrentProfile();
  const isOwner = profile?.roles?.includes("OWNER") ?? false;
  const isStudent = profile?.roles?.includes("STUDENT") ?? false;

  if (!profile || (!isStudent && !isOwner)) {
    redirect("/");
  }

  const supabase = await createClient();

  const effectiveStudentId = isStudent ? profile.student_id : pickedStudentId || null;

  let studentOptions: { id: string; name: string; code?: string | null }[] = [];
  if (isOwner) {
    const { data } = await supabase
      .from("students")
      .select("id, name, student_code")
      .order("name");
    studentOptions = (data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      code: s.student_code,
    }));
  }

  if (!effectiveStudentId) {
    return (
      <div>
        <h1 className="text-3xl font-extrabold text-bmos-text mb-4">
          My Schedule
        </h1>
        {isOwner ? (
          <>
            <OwnerPreviewPicker
              paramKey="studentId"
              options={studentOptions}
              selectedId={null}
              roleLabel="Murid"
            />
            <p className="text-sm text-bmos-text-light">
              Pilih Murid dulu buat liat jadwal aslinya.
            </p>
          </>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
            Akun kamu belum dihubungkan ke data Murid. Minta Owner buat
            hubungkan lewat halaman Accounts.
          </div>
        )}
      </div>
    );
  }

  const { data: student } = await supabase
    .from("students")
    .select("class_id, class_name, teacher_name")
    .eq("id", effectiveStudentId)
    .maybeSingle();

  const offset = Number(week || "0");
  const monday = getMondayOfWeek(offset);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const mondayStr = monday.toISOString().slice(0, 10);
  const sundayStr = sunday.toISOString().slice(0, 10);

  type SessionRow = {
    id: string;
    class_name: string | null;
    session_date: string;
    start_time: string | null;
    end_time: string | null;
    status: string;
  };

  const { data: sessions } = student?.class_id
    ? await supabase
        .from("sessions")
        .select("id, class_name, session_date, start_time, end_time, status")
        .eq("class_id", student.class_id)
        .gte("session_date", mondayStr)
        .lte("session_date", sundayStr)
        .order("start_time")
    : { data: [] as SessionRow[] };

  const byDay: Record<string, SessionRow[]> = {};
  DAYS.forEach((d) => (byDay[d] = []));
  (sessions ?? []).forEach((s) => {
    const date = new Date(s.session_date + "T00:00:00");
    const jsDay = date.getDay();
    const dayName = DAYS[jsDay === 0 ? 6 : jsDay - 1];
    byDay[dayName]!.push(s);
  });

  const weekLabel =
    offset === 0 ? "Minggu Ini" : offset > 0 ? `${offset} Minggu Lagi` : `${Math.abs(offset)} Minggu Lalu`;
  const dateRangeLabel = `${formatDateID(monday)} - ${formatDateID(sunday)}`;
  const totalSessions = (sessions ?? []).length;

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-1">
        My Schedule
      </h1>
      {student?.class_name && (
        <p className="text-bmos-text-light text-sm mb-6">
          {student.class_name} · {student.teacher_name}
        </p>
      )}

      {isOwner && (
        <OwnerPreviewPicker
          paramKey="studentId"
          options={studentOptions}
          selectedId={effectiveStudentId}
          roleLabel="Murid"
        />
      )}

      <div className="bg-white border border-bmos-border rounded-2xl p-5 mb-6 flex items-center justify-between flex-wrap gap-4">
        <WeekNavigator weekLabel={weekLabel} dateRangeLabel={dateRangeLabel} />
        <p className="text-sm text-bmos-text-light">
          {totalSessions} sesi minggu ini
        </p>
      </div>

      {totalSessions === 0 ? (
        <div className="bg-white border border-bmos-border rounded-2xl p-10 text-center text-bmos-text-light">
          Belum ada jadwal di minggu ini.
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
