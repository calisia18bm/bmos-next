import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import OwnerPreviewPicker from "@/components/OwnerPreviewPicker";

export const dynamic = "force-dynamic";

// Cuma OWNER (BUKAN Admin) yang boleh preview & pilih Laoshi tertentu di
// sini -- Admin sengaja ga dikasih, karena ini nampilin data personal
// (daftar murid) milik Laoshi. Laoshi asli tetap cuma bisa liat murid
// dirinya sendiri, ga kepengaruh apapun di halaman ini.
export default async function MyStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ teacherId?: string }>;
}) {
  const { teacherId: pickedTeacherId } = await searchParams;
  const profile = await getCurrentProfile();
  const isOwner = profile?.roles?.includes("OWNER") ?? false;
  const isTeacher = profile?.roles?.includes("TEACHER") ?? false;

  if (!profile || (!isTeacher && !isOwner)) {
    redirect("/");
  }

  const supabase = await createClient();

  const effectiveTeacherId = isTeacher ? profile.teacher_id : pickedTeacherId || null;

  let teacherOptions: { id: string; name: string; code?: string | null }[] = [];
  if (isOwner) {
    const { data } = await supabase
      .from("teachers")
      .select("id, name, teacher_code")
      .order("name");
    teacherOptions = (data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      code: t.teacher_code,
    }));
  }

  if (!effectiveTeacherId) {
    return (
      <div>
        <h1 className="text-3xl font-extrabold text-bmos-text mb-4">
          My Student
        </h1>
        {isOwner ? (
          <>
            <OwnerPreviewPicker
              paramKey="teacherId"
              options={teacherOptions}
              selectedId={null}
              roleLabel="Laoshi"
            />
            <p className="text-sm text-bmos-text-light">
              Pilih Laoshi dulu buat liat daftar murid aslinya.
            </p>
          </>
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
    .eq("teacher_id", effectiveTeacherId);
  const classIds = (classes ?? []).map((c) => c.id);

  const { data: students } = classIds.length
    ? await supabase
        .from("students")
        .select("id, name, class_name, payment_status, status")
        .in("class_id", classIds)
        .order("name")
    : { data: [] };

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-6">
        My Student
      </h1>

      {isOwner && (
        <OwnerPreviewPicker
          paramKey="teacherId"
          options={teacherOptions}
          selectedId={effectiveTeacherId}
          roleLabel="Laoshi"
        />
      )}

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        {(students ?? []).length === 0 ? (
          <div className="text-center py-14">
            <p className="text-3xl mb-2">🧑‍🎓</p>
            <p className="text-bmos-text font-semibold">Belum ada murid</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-bmos-text-light border-b border-bmos-border">
                <th className="px-5 py-3 font-medium">Nama</th>
                <th className="px-5 py-3 font-medium">Kelas</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(students ?? []).map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-bmos-border last:border-0"
                >
                  <td className="px-5 py-3 font-semibold text-bmos-text">
                    {s.name}
                  </td>
                  <td className="px-5 py-3 text-bmos-text-light">
                    {s.class_name}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-bmos-primary-soft text-bmos-primary">
                      {s.payment_status}
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
