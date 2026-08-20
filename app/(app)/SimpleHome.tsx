import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import HomeBanner from "./HomeBanner";
import NameEditor from "./NameEditor";
import { BannerItem } from "@/lib/characters";
import { UserProfile } from "@/lib/auth";

// Home yang disederhanakan buat Laoshi & Murid -- mereka ga perlu lihat
// data bisnis (income, jumlah murid semua, dst) kayak Owner/Admin.
// Cukup jadwal hari ini yang relevan buat mereka aja.
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

  let classIds: string[] = [];
  let linked = true;

  if (isTeacher) {
    if (!profile.teacher_id) {
      linked = false;
    } else {
      const { data: classes } = await supabase
        .from("classes")
        .select("id")
        .eq("teacher_id", profile.teacher_id);
      classIds = (classes ?? []).map((c) => c.id);
    }
  } else {
    // STUDENT
    if (!profile.student_id) {
      linked = false;
    } else {
      const { data: student } = await supabase
        .from("students")
        .select("class_id")
        .eq("id", profile.student_id)
        .maybeSingle();
      if (student?.class_id) classIds = [student.class_id];
    }
  }

  const { data: todaySessions } = classIds.length
    ? await supabase
        .from("sessions")
        .select("*")
        .eq("session_date", today)
        .in("class_id", classIds)
        .order("start_time")
    : { data: [] };

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

      {!linked && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6 text-sm text-yellow-800">
          Akun kamu belum dihubungkan ke data {isTeacher ? "Laoshi" : "Murid"}{" "}
          di Master Data. Minta Owner buat hubungkan lewat halaman Accounts,
          biar jadwal & materi kamu bisa muncul di sini.
        </div>
      )}

      <div className="bg-white border border-bmos-border rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-bmos-text text-lg">
            Today&apos;s Schedule
          </h2>
          <span className="text-xs text-bmos-text-light">
            {(todaySessions ?? []).length} kelas hari ini
          </span>
        </div>
        {(todaySessions ?? []).length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-bmos-text font-semibold">
              Tidak ada kelas hari ini
            </p>
            <p className="text-sm text-bmos-text-light">
              Jadwal hari ini masih kosong.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {(todaySessions ?? []).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 bg-bmos-primary-soft/30 rounded-xl"
              >
                <div>
                  <p className="text-sm font-semibold text-bmos-text">
                    {s.class_name}
                  </p>
                  <p className="text-xs text-bmos-text-light">
                    {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                    {isTeacher ? "" : ` · ${s.teacher_planned ?? ""}`}
                  </p>
                </div>
                <span className="text-xs font-semibold text-bmos-primary">
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link
          href="/weekly-schedule"
          className="inline-block mt-4 text-sm font-semibold text-bmos-primary hover:underline"
        >
          Lihat jadwal lengkap →
        </Link>
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl p-6">
        <h2 className="font-bold text-bmos-text text-lg mb-1">
          Materi Pelajaran
        </h2>
        <p className="text-sm text-bmos-text-light py-4">
          Fitur berbagi materi (PPT dll) segera hadir di sini.
        </p>
      </div>
    </div>
  );
}
