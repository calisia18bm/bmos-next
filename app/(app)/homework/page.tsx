import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import TeacherHomework from "./TeacherHomework";
import StudentHomework from "./StudentHomework";

export const dynamic = "force-dynamic";

type SubmissionRow = {
  id: string;
  homework_id: string;
  student_id: string;
  student_name: string;
  submission_type: string;
  answer_text: string | null;
  file_url: string | null;
  file_name: string | null;
  submitted_at: string;
};

// Pola sama kayak halaman Materi & Class Card -- Owner/Admin liat SEMUA
// sudut pandang lewat ?as=..., Murid/Laoshi asli langsung dapet
// tampilan role mereka sendiri.
export default async function HomeworkPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const { as } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isStaff = profile.roles.includes("OWNER") || profile.roles.includes("ADMIN");
  const isOwner = profile.roles.includes("OWNER");
  const isTeacher = profile.roles.includes("TEACHER");
  const isStudent = profile.roles.includes("STUDENT");

  const previewAsStudent = isOwner && as === "student";
  const previewAsTeacher = isOwner && as === "teacher" && !previewAsStudent;

  const supabase = await createClient();

  // ===== LAOSHI: bikin PR & lihat jawaban murid di kelas dia sendiri =====
  if ((isTeacher && !isStaff) || previewAsTeacher) {
    if (!previewAsTeacher && !profile.teacher_id) {
      return (
        <div>
          <h1 className="text-3xl font-extrabold text-bmos-text mb-4">PR</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
            Akun kamu belum dihubungkan ke data Laoshi. Minta Owner buat
            hubungkan lewat halaman Accounts.
          </div>
        </div>
      );
    }

    const classesQuery = previewAsTeacher
      ? supabase.from("classes").select("id, name").order("name")
      : supabase
          .from("classes")
          .select("id, name")
          .eq("teacher_id", profile.teacher_id!)
          .order("name");

    const { data: classes } = await classesQuery;
    const classIds = (classes ?? []).map((c) => c.id);

    const [{ data: homeworks }, { data: studentsInClasses }] = await Promise.all([
      classIds.length
        ? supabase
            .from("homework")
            .select("id, class_id, class_name, teacher_id, title, description, due_date, created_at")
            .in("class_id", classIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      classIds.length
        ? supabase.from("students").select("class_id").in("class_id", classIds)
        : Promise.resolve({ data: [] }),
    ]);

    const classSizeById: Record<string, number> = {};
    (studentsInClasses ?? []).forEach((s) => {
      if (!s.class_id) return;
      classSizeById[s.class_id] = (classSizeById[s.class_id] ?? 0) + 1;
    });

    const homeworkIds = (homeworks ?? []).map((h) => h.id);
    const { data: submissions } = homeworkIds.length
      ? await supabase
          .from("homework_submissions")
          .select(
            "id, homework_id, student_id, student_name, submission_type, answer_text, file_url, file_name, submitted_at"
          )
          .in("homework_id", homeworkIds)
      : { data: [] as SubmissionRow[] };

    const submissionsByHomework: Record<string, SubmissionRow[]> = {};
    (submissions ?? []).forEach((s) => {
      if (!submissionsByHomework[s.homework_id]) submissionsByHomework[s.homework_id] = [];
      submissionsByHomework[s.homework_id]!.push(s);
    });

    return (
      <div>
        {previewAsTeacher && (
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Preview Laoshi
          </p>
        )}
        <h1 className="text-3xl font-extrabold text-bmos-text mb-1">PR</h1>
        <p className="text-bmos-text-light text-sm mb-6">
          Bikin PR buat kelas kamu, lihat jawaban Murid (teks/suara/video/file).
        </p>
        {previewAsTeacher && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4 text-sm text-blue-800">
            👁️ Preview tampilan Laoshi -- bikin/hapus PR di sini tetap
            beneran kesimpen (login-nya tetap sebagai kamu), cuma buat
            liat tampilannya aja.
          </div>
        )}
        <TeacherHomework
          classes={classes ?? []}
          homeworks={(homeworks ?? []) as never}
          submissionsByHomework={submissionsByHomework as never}
          classSizeById={classSizeById}
          isStaff={previewAsTeacher}
          myTeacherId={previewAsTeacher ? null : profile.teacher_id}
        />
      </div>
    );
  }

  // ===== MURID: lihat PR kelas dia & submit jawaban =====
  if ((isStudent && !isStaff && !isTeacher) || previewAsStudent) {
    if (!previewAsStudent && !profile.student_id) {
      return (
        <div>
          <h1 className="text-3xl font-extrabold text-bmos-text mb-4">PR</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
            Akun kamu belum dihubungkan ke data Murid. Minta Owner buat
            hubungkan lewat halaman Accounts.
          </div>
        </div>
      );
    }

    let homeworks: {
      id: string;
      title: string;
      description: string | null;
      due_date: string | null;
      created_at: string;
    }[] = [];
    let mySubmissions: Record<string, unknown> = {};

    if (previewAsStudent) {
      const { data } = await supabase
        .from("homework")
        .select("id, title, description, due_date, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      homeworks = data ?? [];
    } else {
      const { data: student } = await supabase
        .from("students")
        .select("id, class_id")
        .eq("id", profile.student_id!)
        .maybeSingle();

      if (student?.class_id) {
        const { data } = await supabase
          .from("homework")
          .select("id, title, description, due_date, created_at")
          .eq("class_id", student.class_id)
          .order("created_at", { ascending: false });
        homeworks = data ?? [];

        const homeworkIds = homeworks.map((h) => h.id);
        if (homeworkIds.length) {
          const { data: subs } = await supabase
            .from("homework_submissions")
            .select("homework_id, submission_type, answer_text, file_url, file_name, submitted_at")
            .eq("student_id", student.id)
            .in("homework_id", homeworkIds);
          (subs ?? []).forEach((s) => {
            mySubmissions[s.homework_id] = s;
          });
        }
      }
    }

    return (
      <div>
        {previewAsStudent && (
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Preview Murid
          </p>
        )}
        <h1 className="text-3xl font-extrabold text-bmos-text mb-1">PR</h1>
        <p className="text-bmos-text-light text-sm mb-6">
          Submit jawaban PR kamu -- bisa teks, suara, video, atau file lain.
        </p>
        {previewAsStudent && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4 text-sm text-blue-800">
            👁️ Preview tampilan Murid -- ini yang beneran dilihat akun
            Murid (submit di sini dimatiin biar ga ke-submit beneran).
          </div>
        )}
        <StudentHomework
          homeworks={homeworks}
          mySubmissions={mySubmissions as never}
          disabled={previewAsStudent}
        />
      </div>
    );
  }

  // ===== OWNER/ADMIN: pantau semua PR di semua kelas =====
  if (isStaff) {
    const [{ data: classes }, { data: homeworks }, { data: studentsAll }] = await Promise.all([
      supabase.from("classes").select("id, name").order("name"),
      supabase
        .from("homework")
        .select("id, class_id, class_name, teacher_id, title, description, due_date, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("students").select("class_id"),
    ]);

    const classSizeById: Record<string, number> = {};
    (studentsAll ?? []).forEach((s) => {
      if (!s.class_id) return;
      classSizeById[s.class_id] = (classSizeById[s.class_id] ?? 0) + 1;
    });

    const homeworkIds = (homeworks ?? []).map((h) => h.id);
    const { data: submissions } = homeworkIds.length
      ? await supabase
          .from("homework_submissions")
          .select(
            "id, homework_id, student_id, student_name, submission_type, answer_text, file_url, file_name, submitted_at"
          )
          .in("homework_id", homeworkIds)
      : { data: [] as SubmissionRow[] };

    const submissionsByHomework: Record<string, SubmissionRow[]> = {};
    (submissions ?? []).forEach((s) => {
      if (!submissionsByHomework[s.homework_id]) submissionsByHomework[s.homework_id] = [];
      submissionsByHomework[s.homework_id]!.push(s);
    });

    return (
      <div>
        <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
          Admin
        </p>
        <h1 className="text-3xl font-extrabold text-bmos-text mb-6">PR</h1>
        <TeacherHomework
          classes={classes ?? []}
          homeworks={(homeworks ?? []) as never}
          submissionsByHomework={submissionsByHomework as never}
          classSizeById={classSizeById}
          isStaff={true}
          myTeacherId={null}
        />
      </div>
    );
  }

  redirect("/");
}
