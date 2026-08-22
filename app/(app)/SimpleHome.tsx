import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import HomeBanner from "./HomeBanner";
import NameEditor from "./NameEditor";
import { BannerItem } from "@/lib/characters";
import { UserProfile } from "@/lib/auth";
import { getAnnouncements } from "./announcements/actions";

function getMondayOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Hari ini";
  if (days === 1) return "1 hari lalu";
  return `${days} hari lalu`;
}

type NextClass = { class_name: string; session_date: string; start_time: string };
type TeacherStats = { studentCount: number; finishedThisWeek: number; totalThisWeek: number };
type StudentStats = { sessionsUsed: number; sessionsTotal: number; paymentStatus: string };

// Home yang disederhanakan buat Laoshi, Murid, & Admin -- fokus ke info/
// pengumuman + ringkasan singkat aja. Jadwal lengkap, daftar murid, dan
// riwayat pembayaran masing-masing punya halaman sendiri di sidebar
// ("Jadwal Saya", "My Students", "My Payments"), ga ditumpuk semua di
// Home kayak dashboard Owner. Buat Admin, isinya masih placeholder --
// widget-nya masih dipikirin, sementara cukup banner + pengumuman dulu.
export default async function SimpleHome({
  profile,
  bannerItems,
  canEditBanner,
}: {
  profile: UserProfile;
  bannerItems: BannerItem[];
  canEditBanner: boolean;
}) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const isTeacher = profile.roles.includes("TEACHER");
  const isStudentSimple = profile.roles.includes("STUDENT");
  // Bukan Laoshi & bukan Murid -- berarti Admin (atau role lain yang
  // belum ada halaman Home khususnya). Belum ada audience "ADMIN" di
  // tabel announcements, jadi Admin cuma liat yang audience-nya "ALL".
  const isAdmin = !isTeacher && !isStudentSimple;

  const announcements = await getAnnouncements(
    5,
    isTeacher ? ["ALL", "TEACHER"] : isStudentSimple ? ["ALL", "STUDENT"] : ["ALL"]
  );

  let linked = true;
  let nextClass: NextClass | null = null;
  let teacherStats: TeacherStats | null = null;
  let studentStats: StudentStats | null = null;

  if (isAdmin) {
    // Belum ada widget khusus Admin -- sementara skip semua fetch
    // jadwal/statistik, cukup banner + pengumuman aja dulu.
  } else if (isTeacher) {
    if (!profile.teacher_id) {
      linked = false;
    } else {
      const { data: classes } = await supabase
        .from("classes")
        .select("id")
        .eq("teacher_id", profile.teacher_id);
      const classIds = (classes ?? []).map((c) => c.id);

      if (classIds.length > 0) {
        const { count: studentCount } = await supabase
          .from("students")
          .select("*", { count: "exact", head: true })
          .in("class_id", classIds)
          .eq("status", "ACTIVE");

        const weekStart = getMondayOfWeek();
        const { data: weekSessions } = await supabase
          .from("sessions")
          .select("status")
          .in("class_id", classIds)
          .gte("session_date", weekStart);
        const finishedThisWeek = (weekSessions ?? []).filter(
          (s) => s.status === "FINISHED"
        ).length;

        teacherStats = {
          studentCount: studentCount ?? 0,
          finishedThisWeek,
          totalThisWeek: (weekSessions ?? []).length,
        };

        const { data: nextSessions } = await supabase
          .from("sessions")
          .select("class_name, session_date, start_time")
          .in("class_id", classIds)
          .gte("session_date", today)
          .order("session_date")
          .order("start_time")
          .limit(1);
        nextClass = nextSessions?.[0] ?? null;
      }
    }
  } else {
    // STUDENT
    if (!profile.student_id) {
      linked = false;
    } else {
      const { data: student } = await supabase
        .from("students")
        .select("class_id, sessions_used, sessions_per_package, payment_status")
        .eq("id", profile.student_id)
        .maybeSingle();

      if (student) {
        studentStats = {
          sessionsUsed: student.sessions_used ?? 0,
          sessionsTotal: student.sessions_per_package ?? 0,
          paymentStatus: student.payment_status ?? "-",
        };

        if (student.class_id) {
          const { data: nextSessions } = await supabase
            .from("sessions")
            .select("class_name, session_date, start_time")
            .eq("class_id", student.class_id)
            .gte("session_date", today)
            .order("session_date")
            .order("start_time")
            .limit(1);
          nextClass = nextSessions?.[0] ?? null;
        }
      }
    }
  }

  const quickLinks = isAdmin
    ? [
        { href: "/students", label: "Students", icon: "🧑‍🎓" },
        { href: "/classes", label: "Classes", icon: "📚" },
        { href: "/payments", label: "Payments", icon: "💳" },
      ]
    : isTeacher
    ? [
        { href: "/my-schedule", label: "Jadwal Saya", icon: "🗓️" },
        { href: "/my-students", label: "Murid Saya", icon: "🧑‍🎓" },
      ]
    : [
        { href: "/my-class", label: "Jadwal Saya", icon: "🗓️" },
        { href: "/my-payments", label: "Pembayaran Saya", icon: "💳" },
      ];

  return (
    <div className="relative">
      <HomeBanner items={bannerItems} canEdit={canEditBanner} />

      <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
        Overview
      </p>
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-bmos-text leading-tight">
          Selamat Datang
        </h1>
        <NameEditor fullName={profile.full_name} />
      </div>

      {!isAdmin && !linked && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6 text-sm text-yellow-800">
          Akun kamu belum dihubungkan ke data {isTeacher ? "Laoshi" : "Murid"}{" "}
          di Master Data. Minta Owner buat hubungkan lewat halaman Accounts,
          biar info & jadwal kamu bisa muncul di sini.
        </div>
      )}

      {isAdmin ? (
        // Widget dashboard Admin masih dipikirin -- sementara placeholder
        // dulu, quick link di bawah ini udah nyambung ke halaman aslinya.
        <div className="bg-white border border-bmos-border rounded-2xl p-6 mb-6 text-center">
          <p className="text-sm text-bmos-text-light">
            Dashboard Admin masih disiapkan. Sementara pakai quick link di
            bawah atau menu sidebar buat akses Students, Payments, dll.
          </p>
        </div>
      ) : (
        // Ringkasan singkat -- detail lengkapnya ada di halaman masing-
        // masing lewat quick link di bawah.
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-bmos-border rounded-2xl p-5">
            <p className="text-xs text-bmos-text-light mb-1">Kelas Berikutnya</p>
            {nextClass ? (
              <>
                <p className="font-bold text-bmos-text">{nextClass.class_name}</p>
                <p className="text-xs text-bmos-text-light">
                  {new Date(nextClass.session_date).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {nextClass.start_time?.slice(0, 5)}
                </p>
              </>
            ) : (
              <p className="text-sm text-bmos-text-light">Belum ada jadwal</p>
            )}
          </div>

          {isTeacher ? (
            <>
              <div className="bg-white border border-bmos-border rounded-2xl p-5">
                <p className="text-xs text-bmos-text-light mb-1">Murid Diajar</p>
                <p className="text-2xl font-extrabold text-bmos-text">
                  {teacherStats?.studentCount ?? 0}
                </p>
              </div>
              <div className="bg-white border border-bmos-border rounded-2xl p-5">
                <p className="text-xs text-bmos-text-light mb-1">Sesi Minggu Ini</p>
                <p className="text-2xl font-extrabold text-bmos-text">
                  {teacherStats
                    ? `${teacherStats.finishedThisWeek}/${teacherStats.totalThisWeek}`
                    : "0/0"}
                </p>
                <p className="text-xs text-bmos-text-light">sudah diajar</p>
              </div>
            </>
          ) : (
            <>
              <div className="bg-white border border-bmos-border rounded-2xl p-5">
                <p className="text-xs text-bmos-text-light mb-1">Sisa Sesi</p>
                <p className="text-2xl font-extrabold text-bmos-text">
                  {studentStats
                    ? Math.max(0, studentStats.sessionsTotal - studentStats.sessionsUsed)
                    : "-"}
                  <span className="text-sm font-normal text-bmos-text-light">
                    {" "}
                    / {studentStats ? studentStats.sessionsTotal : "-"}
                  </span>
                </p>
              </div>
              <div className="bg-white border border-bmos-border rounded-2xl p-5">
                <p className="text-xs text-bmos-text-light mb-1">Status Pembayaran</p>
                <p className="text-lg font-bold text-bmos-text">
                  {studentStats ? studentStats.paymentStatus : "-"}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        {quickLinks.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="flex items-center gap-2 bg-white border border-bmos-border rounded-xl px-4 py-2.5 text-sm font-semibold text-bmos-text hover:bg-bmos-primary-soft transition"
          >
            <span>{q.icon}</span>
            {q.label}
          </Link>
        ))}
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl p-6">
        <h2 className="font-bold text-bmos-text text-lg mb-1">Pengumuman</h2>
        <p className="text-xs text-bmos-text-light mb-4">
          Info terbaru dari Owner/Admin
        </p>
        {announcements.length === 0 ? (
          <p className="text-sm text-bmos-text-light text-center py-8">
            Belum ada pengumuman.
          </p>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="border-b border-bmos-border last:border-0 pb-3 last:pb-0"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-semibold text-bmos-text">
                    {a.title}
                  </p>
                  <span className="text-xs text-bmos-text-light whitespace-nowrap">
                    {timeAgo(a.created_at)}
                  </span>
                </div>
                <p className="text-sm text-bmos-text-light whitespace-pre-wrap">
                  {a.message}
                </p>
                {a.created_by && (
                  <p className="text-xs text-bmos-text-light mt-1">
                    — {a.created_by}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
