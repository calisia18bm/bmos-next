import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { after } from "next/server";
import TeacherClassCards from "./TeacherClassCards";
import StudentClassBrowse from "./StudentClassBrowse";
import OwnerApprovalQueue from "./OwnerApprovalQueue";
import {
  getCommissionTiers,
  getGoalTags,
  getMyClassEnrollments,
  getPendingJoinRequests,
  getPendingMonthlyPayments,
  getMinTeacherResourceMonths,
  getRegistrationFormUrl,
  markClassCardsSeen,
} from "./actions";
import JoinRequestsQueue from "./JoinRequestsQueue";
import MonthlyPaymentsQueue from "./MonthlyPaymentsQueue";
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
            Akun kamu belum dihubungkan ke data Laoshi. Minta BM buat
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
    // sekarang, biar kunjungan BERIKUTNYA baru ilang highlight/badge-nya.
    //
    // PENTING: pake after() (bukan await langsung) -- dijadwalin jalan
    // SETELAH response halaman ini selesai dikirim ke browser, bukan pas
    // masih render. Soalnya app/(app)/layout.tsx (yang ngitung badge
    // angka di sidebar) itu KOMPONEN TERPISAH yang Next.js boleh render
    // BARENGAN (paralel) sama page ini dalam request yang sama -- kalau
    // markClassCardsSeen() dipanggil langsung di sini (await), bisa aja
    // dia keduluan/bareng sama layout.tsx lagi ngitung badge, jadi
    // badge-nya kebaca masih "lama" (belum ke-update) walau kartunya
    // udah keliatan ditandain dibuka. Ini yang bikin badge di sidebar ga
    // ilang-ilang walau halamannya udah dibuka. Dengan after(), update-nya
    // dipastikan baru jalan SETELAH render selesai, jadi request/refresh
    // berikutnya pasti udah baca data yang fresh.
    if (!previewAsTeacher) {
      after(() => markClassCardsSeen());
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
          Buat kartu kelas sendiri (jadwal, harga, kuota, tujuan belajar),
          submit buat di-approve BM sebelum tayang buat Murid.
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
            Akun kamu belum dihubungkan ke data Murid. Minta BM buat
            hubungkan lewat halaman Accounts.
          </div>
        </div>
      );
    }

    const [{ data: cards }, myEnrollments, registrationFormUrl] = await Promise.all([
      supabase
        .from("classes")
        .select("*")
        .eq("approval_status", "APPROVED")
        .eq("active", true)
        .not("created_by_teacher_id", "is", null)
        .order("created_at", { ascending: false }),
      previewAsStudent ? Promise.resolve([]) : getMyClassEnrollments(),
      getRegistrationFormUrl(),
    ]);

    // Kuota per kelas sekarang dihitung dari enrollments (request_status
    // APPROVED + status ACTIVE) -- bukan dari students.class_id lagi,
    // soalnya students.class_id cuma kepake buat kelas REGULAR (lihat
    // approveJoinRequest() di actions.ts). Kalau cuma ngandelin
    // students.class_id, Murid yang join Seminar ga bakal kehitung.
    const classIds = (cards ?? []).map((c) => c.id);
    const { data: approvedEnrollments } = classIds.length
      ? await supabase
          .from("enrollments")
          .select("class_id")
          .in("class_id", classIds)
          .eq("request_status", "APPROVED")
          .eq("status", "ACTIVE")
      : { data: [] };
    const countByClass = new Map<string, number>();
    (approvedEnrollments ?? []).forEach((e) => {
      if (!e.class_id) return;
      countByClass.set(e.class_id, (countByClass.get(e.class_id) ?? 0) + 1);
    });

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
          myEnrollments={myEnrollments}
          disabled={previewAsStudent}
          registrationFormUrl={registrationFormUrl}
        />
      </div>
    );
  }

  // ===== OWNER/ADMIN: approval queue + pantau semua kartu kelas =====
  if (isStaff) {
    const [
      { data: cards },
      tiers,
      goalTags,
      registrationFormUrl,
      joinRequests,
      monthlyPayments,
      minTeacherResourceMonths,
    ] = await Promise.all([
      supabase
        .from("classes")
        .select("*")
        .not("created_by_teacher_id", "is", null)
        .order("created_at", { ascending: false }),
      getCommissionTiers(),
      getGoalTags(),
      getRegistrationFormUrl(),
      getPendingJoinRequests(),
      getPendingMonthlyPayments(),
      getMinTeacherResourceMonths(),
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
        <JoinRequestsQueue requests={joinRequests} />
        <MonthlyPaymentsQueue payments={monthlyPayments} />
        <OwnerApprovalQueue
          cards={(cards ?? []) as ClassCard[]}
          tiers={tiers}
          goalTags={goalTags}
          registrationFormUrl={registrationFormUrl}
          canApprove={isOwner}
          minTeacherResourceMonths={minTeacherResourceMonths}
        />
      </div>
    );
  }

  redirect("/");
}
