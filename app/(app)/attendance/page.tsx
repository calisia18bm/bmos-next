import { createClient } from "@/lib/supabase/server";
import ClassDateSelector from "./ClassDateSelector";
import AttendanceForm from "./AttendanceForm";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; date?: string }>;
}) {
  const params = await searchParams;
  const classId = params.classId || "";
  const date = params.date || new Date().toISOString().slice(0, 10);

  const supabase = await createClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("active", true)
    .order("name");

  let students: { id: string; name: string; student_code: string }[] = [];
  let existing: { student_id: string; status: string }[] = [];

  if (classId) {
    const [enrollmentResult, attendanceResult] = await Promise.all([
      supabase
        .from("enrollments")
        .select("students(id, name, student_code, status)")
        .eq("class_id", classId)
        .eq("status", "ACTIVE"),
      supabase
        .from("attendance")
        .select("student_id, status")
        .eq("class_id", classId)
        .eq("attendance_date", date),
    ]);

    type EnrolledStudent = { id: string; name: string; student_code: string; status: string };
    const enrolledRows = (enrollmentResult.data ?? []) as unknown as { students: EnrolledStudent | null }[];
    const seen = new Set<string>();
    students = enrolledRows
      .map((r) => r.students)
      .filter((s): s is EnrolledStudent => Boolean(s) && s!.status === "ACTIVE")
      .filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      })
      .map((s) => ({ id: s.id, name: s.name, student_code: s.student_code }));

    existing = attendanceResult.data ?? [];
  }

  return (
    <div>
      <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
        Operations
      </p>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-1">
        Attendance
      </h1>
      <p className="text-bmos-text-light text-sm mb-6">
        Catat kehadiran murid per sesi kelas.
      </p>

      <ClassDateSelector classes={classes ?? []} />

      {!classId ? (
        <div className="bg-white border border-bmos-border rounded-2xl p-10 text-center text-bmos-text-light">
          Pilih kelas dulu untuk mulai catat absensi.
        </div>
      ) : (
        <AttendanceForm
          classId={classId}
          date={date}
          students={students}
          existing={existing}
        />
      )}
    </div>
  );
}
