import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import OwnerPreviewPicker from "@/components/OwnerPreviewPicker";

export const dynamic = "force-dynamic";

// Cuma OWNER (BUKAN Admin) yang boleh preview & pilih Murid tertentu di
// sini -- ini data personal (jadwal) milik Murid, sengaja ga dikasih ke
// Admin. Murid asli tetap cuma bisa liat jadwal dirinya sendiri.
export default async function MyClassStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { studentId: pickedStudentId } = await searchParams;
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

  const today = new Date().toISOString().slice(0, 10);
  const { data: sessions } = student?.class_id
    ? await supabase
        .from("sessions")
        .select("id, class_name, session_date, start_time, end_time, status")
        .eq("class_id", student.class_id)
        .gte("session_date", today)
        .order("session_date")
        .order("start_time")
    : { data: [] };

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
