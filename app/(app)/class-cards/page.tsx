import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import TeacherClassCards from "./TeacherClassCards";
import StudentClassBrowse from "./StudentClassBrowse";
import OwnerApprovalQueue from "./OwnerApprovalQueue";
import {
  getCommissionTiers,
  getGoalTags,
  getRegistrationFormUrl,
  markClassCardsSeen,
} from "./actions";
import { ClassCard } from "@/lib/classCards";

export const dynamic = "force-dynamic";

// Sama kayak halaman Materi -- Owner/Admin liat SEMUA sudut pandang
// (Murid/Laoshi/Admin) di akun mereka sendiri lewat query ?as=..., biar
// gampang QA tanpa perlu akun terpisah. Murid/Laoshi asli (bukan Owner)
// yang buka /class-cards langsung dapet tampilan role mereka sendiri.
export default async function ClassCardsPage({
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

  // ===== LAOSHI: bikin & pantau kartu kelas sendiri =====
  if ((isTeacher && !isStaff) || previewAsTeacher) {
    if (!previewAsTeacher && !profile.teacher_id) {
      return (
        <div>
          <h1 className="text-3xl font-extrabold text-bmos-text mb-4">Class Card</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
            Akun kamu belum dihubungkan ke data Laoshi. Minta Owner buat
            hubungkan lewat halaman Accounts.
          </div>
        </div>
      );
    }

    const teacherId = previewAsTeacher ? null : profile.teacher_id;
    const query = teacherId
      ? supabase
          .from("classes")
          .select("*")
          .eq("created_by_teacher_id", teacherId)
          .order("created_at", { ascending: false })
      : supabase
          .from("classes")
          .select("*")
          .not("created_by_teacher_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(20);

    const [{ data: myCards }, tiers, goalTags] = await Promise.all([
      query,
      getCommissionTiers(),
      getGoalTags(),
    ]);

    // Laoshi asli (bukan preview Owner) yang buka halaman ini -- tandain
    // semua kartu kelas dia sebagai "udah dilihat" statusnya yang
    // sekarang. Dipanggil SETELAH ambil myCards di atas, biar kunjungan
    // ini sendiri masih sempat nampilin highlight "Baru" (pakai data lama
    // sebelum di-update), baru kunjungan berikutnya highlight-nya ilang.
    if (!previewAsTeacher) {
      await markClassCardsSeen();
    }

    return (
      <div>
        {previewAsTeacher && (
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Preview Laoshi
          </p>
        )}
        <h1 className="text-3xl font-extrabold text-bmos-text mb-1">Class Card</h1>
        <p className="text-bmos-text-light text-sm mb-6">
          Bikin kartu kelas sendiri (jadwal, harga, kuota, tujuan belajar),
          submit buat di-approve Owner sebelum tayang buat Murid.
        </p>
        {previewAsTeacher && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4 text-sm text-blue-800">
            👁️ Preview tampilan Laoshi -- submit di sini tetap beneran
            kesimpen (login-nya tetap sebagai kamu), cuma buat liat
            tampilannya aja.
          </div>
        )}
        <TeacherClassCards
          cards={(myCards ?? []) as ClassCard[]}
          tiers={tiers}
          goalTags={goalTags}
        />
      </div>
    );
  }

  // ===== MURID: pilih & join kelas dari kartu yang udah di-approve =====
  if ((isStudent && !isStaff && !isTeacher) || previewAsStudent) {
    if (!previewAsStudent && !profile.student_id) {
      return (
        <div>
          <h1 className="text-3xl font-extrabold text-bmos-text mb-4">Class Card</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
            Akun kamu belum dihubungkan ke data Murid. Minta Owner buat
            hubungkan lewat halaman Accounts.
          </div>
        </div>
      );
    }

    const [{ data: cards }, { data: me }, registrationFormUrl] = await Promise.all([
      supabase
        .from("classes")
        .select("*")
        .eq("approval_status", "APPROVED")
        .eq("active", true)
        .not("created_by_teacher_id", "is", null)
        .order("created_at", { ascending: false }),
      previewAsStudent
        ? Promise.resolve({ data: null })
        : supabase
            .from("students")
            .select("class_id")
            .eq("id", profile.student_id!)
            .maybeSingle(),
      getRegistrationFormUrl(),
    ]);

    const classIds = (cards ?? []).map((c) => c.id);
    const { data: studentsInClasses } = classIds.length
      ? await supabase.from("students").select("class_id").in("class_id", classIds)
      : { data: [] };
    const countByClass = new Map<string, number>();
    (studentsInClasses ?? []).forEach((s) => {
      if (!s.class_id) return;
      countByClass.set(s.class_id, (countByClass.get(s.class_id) ?? 0) + 1);
    });

    const alreadyHasClass = previewAsStudent ? false : !!me?.class_id;

    return (
      <div>
        {previewAsStudent && (
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Preview Murid
          </p>
        )}
        <h1 className="text-3xl font-extrabold text-bmos-text mb-1">Class Card</h1>
        <p className="text-bmos-text-light text-sm mb-6">
          Klik kartu kelas yang cocok sama tujuan belajar kamu buat join.
        </p>
        {previewAsStudent && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4 text-sm text-blue-800">
            👁️ Preview tampilan Murid -- ini yang beneran dilihat akun
            Murid.
          </div>
        )}
        <StudentClassBrowse
          cards={(cards ?? []) as ClassCard[]}
          countByClass={Object.fromEntries(countByClass)}
          alreadyHasClass={alreadyHasClass}
          disabled={previewAsStudent}
          registrationFormUrl={registrationFormUrl}
        />
      </div>
    );
  }

  // ===== OWNER/ADMIN: approval queue + pantau semua kartu kelas =====
  if (isStaff) {
    const [{ data: cards }, tiers, goalTags, registrationFormUrl] = await Promise.all([
      supabase
        .from("classes")
        .select("*")
        .not("created_by_teacher_id", "is", null)
        .order("created_at", { ascending: false }),
      getCommissionTiers(),
      getGoalTags(),
      getRegistrationFormUrl(),
    ]);

    return (
      <div>
        <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
          Admin
        </p>
        <h1 className="text-3xl font-extrabold text-bmos-text mb-1">
          Approval Kelas
        </h1>
        <p className="text-bmos-text-light text-sm mb-6">
          Kartu kelas yang disubmit Laoshi -- approve biar tayang di
          Classes & bisa dipilih Murid.
        </p>
        <OwnerApprovalQueue
          cards={(cards ?? []) as ClassCard[]}
          tiers={tiers}
          goalTags={goalTags}
          registrationFormUrl={registrationFormUrl}
          canApprove={isOwner}
        />
      </div>
    );
  }

  redirect("/");
}
