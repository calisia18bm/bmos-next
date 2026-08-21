import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MyScheduleTeacherPage() {
  const profile = await getCurrentProfile();
  const isStaff =
    profile?.roles?.includes("OWNER") || profile?.roles?.includes("ADMIN");
  const isTeacher = profile?.roles?.includes("TEACHER");

  // Owner/Admin boleh buka halaman ini juga buat preview (lihat gimana
  // tampilan Laoshi asli), bukan cuma Laoshi beneran -- sebelumnya
  // di-redirect balik ke Home karena role-nya bukan TEACHER.
  if (!profile || (!isTeacher && !isStaff)) {
    redirect("/");
  }

  const supabase = await createClient();

  if (!profile.teacher_id) {
    return (
      <div>
        <h1 className="text-3xl font-extrabold text-bmos-text mb-4">
          My Schedule
        </h1>
        {isStaff ? (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-800">
            👁️ Preview tampilan Laoshi -- akun kamu (Owner/Admin) ga
            dihubungkan ke data Laoshi tertentu, jadi belum ada jadwal
            contoh buat ditampilkan. Laoshi asli yang login bakal liat
            jadwal mereka sendiri di sini.
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
            Akun kamu belum dihubungkan ke data Laoshi. Minta Owner buat
            hubungkan lewat halaman Accounts.
          </div>
        )}
      </div>
    );
  }

  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .eq("teacher_id", profile.teacher_id);
  const classIds = (classes ?? []).map((c) => c.id);

  const today = new Date().toISOString().slice(0, 10);
  const { data: sessions } = classIds.length
    ? await supabase
        .from("sessions")
        .select("id, class_name, session_date, start_time, end_time, status")
        .in("class_id", classIds)
        .gte("session_date", today)
        .order("session_date")
        .order("start_time")
    : { data: [] };

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-6">
        My Schedule
      </h1>

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        {(sessions ?? []).length === 0 ? (
          <div className="text-center py-14">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-bmos-text font-semibold">
              Belum ada jadwal ke depan
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-bmos-text-light border-b border-bmos-border">
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 font-medium">Kelas</th>
                <th className="px-5 py-3 font-medium">Jam</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(sessions ?? []).map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-bmos-border last:border-0"
                >
                  <td className="px-5 py-3 text-bmos-text">
                    {new Date(s.session_date).toLocaleDateString("id-ID", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="px-5 py-3 font-semibold text-bmos-text">
                    {s.class_name}
                  </td>
                  <td className="px-5 py-3 text-bmos-text-light">
                    {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-semibold text-bmos-primary">
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
