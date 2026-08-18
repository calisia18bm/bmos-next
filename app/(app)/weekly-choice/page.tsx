import { createClient } from "@/lib/supabase/server";
import ChoiceSelector from "./ChoiceSelector";
import SendPollsButton from "./SendPollsButton";

export const dynamic = "force-dynamic";

function getMondayOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export default async function WeeklyChoicePage() {
  const supabase = await createClient();
  const weekStart = getMondayOfWeek();

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("active", true);

  // Kelompokkan kelas per nama, cari yang punya >1 laoshi (kelas fleksibel)
  const byName: Record<string, typeof classes> = {};
  (classes ?? []).forEach((c) => {
    if (!byName[c.name]) byName[c.name] = [];
    byName[c.name]!.push(c);
  });

  const flexibleGroups = Object.entries(byName).filter(
    ([, group]) => (group?.length ?? 0) > 1
  );

  const flexibleClassIds = flexibleGroups.flatMap(([, group]) =>
    (group ?? []).map((c) => c.id)
  );

  let students: { id: string; name: string; class_id: string; class_name: string }[] = [];
  let choices: {
    student_id: string;
    class_group_name: string;
    chosen_class_id: string;
    confirmed: boolean;
  }[] = [];

  if (flexibleClassIds.length > 0) {
    const [studentsResult, choicesResult] = await Promise.all([
      supabase
        .from("students")
        .select("id, name, class_id, class_name")
        .in("class_id", flexibleClassIds)
        .eq("status", "ACTIVE"),
      supabase
        .from("weekly_choices")
        .select("student_id, class_group_name, chosen_class_id, confirmed")
        .eq("week_start", weekStart),
    ]);
    students = studentsResult.data ?? [];
    choices = choicesResult.data ?? [];
  }

  const totalStudents = students.length;
  const confirmedCount = students.filter((s) =>
    choices.some(
      (c) =>
        c.student_id === s.id &&
        c.class_group_name === s.class_name &&
        c.confirmed
    )
  ).length;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Schedule
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text mb-1">
            Weekly Choice
          </h1>
          <p className="text-bmos-text-light text-sm">
            Kelas fleksibel dengan lebih dari satu laoshi -- murid konfirmasi
            tiap minggu mau ikut sesi siapa.
          </p>
        </div>
        <SendPollsButton />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <p className="text-sm text-bmos-text-light">
            Total Murid Kelas Fleksibel
          </p>
          <p className="text-2xl font-extrabold text-bmos-text mt-1">
            {totalStudents}
          </p>
        </div>
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <p className="text-sm text-bmos-text-light">Sudah Konfirmasi</p>
          <p className="text-2xl font-extrabold text-green-700 mt-1">
            {confirmedCount}
          </p>
        </div>
        <div className="bg-white border border-bmos-border rounded-2xl p-5">
          <p className="text-sm text-bmos-text-light">Belum Konfirmasi</p>
          <p className="text-2xl font-extrabold text-red-600 mt-1">
            {totalStudents - confirmedCount}
          </p>
        </div>
      </div>

      {flexibleGroups.length === 0 ? (
        <div className="bg-white border border-bmos-border rounded-2xl p-10 text-center text-bmos-text-light">
          Belum ada kelas fleksibel. Kelas fleksibel muncul otomatis kalau
          ada 2+ laoshi mengajar dengan nama kelas yang sama.
        </div>
      ) : (
        <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-bmos-text-light border-b border-bmos-border">
                <th className="px-5 py-3 font-medium">Murid</th>
                <th className="px-5 py-3 font-medium">Kelas</th>
                <th className="px-5 py-3 font-medium">Pilih Jadwal Minggu Ini</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const group = byName[s.class_name] ?? [];
                const existing = choices.find(
                  (c) =>
                    c.student_id === s.id &&
                    c.class_group_name === s.class_name
                );

                return (
                  <tr key={s.id} className="border-b border-bmos-border last:border-0">
                    <td className="px-5 py-3 font-semibold text-bmos-text">
                      {s.name}
                    </td>
                    <td className="px-5 py-3 text-bmos-text">
                      {s.class_name}
                    </td>
                    <td className="px-5 py-3">
                      <ChoiceSelector
                        studentId={s.id}
                        classGroupName={s.class_name}
                        options={group.map((g) => ({
                          id: g.id,
                          teacher_name: g.teacher_name,
                          day_of_week: g.day_of_week,
                          start_time: g.start_time,
                        }))}
                        currentChoice={existing?.chosen_class_id || ""}
                        confirmed={existing?.confirmed || false}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
