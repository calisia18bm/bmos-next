import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import MaterialsManage from "./MaterialsManage";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isStaff = profile.roles.includes("OWNER") || profile.roles.includes("ADMIN");
  const isTeacher = profile.roles.includes("TEACHER");
  const isStudent = profile.roles.includes("STUDENT");

  const supabase = await createClient();

  // ===== MURID: read-only, cuma materi di kelas dia =====
  if (isStudent && !isStaff && !isTeacher) {
    if (!profile.student_id) {
      return (
        <div>
          <h1 className="text-3xl font-extrabold text-bmos-text mb-4">Materi</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
            Akun kamu belum dihubungkan ke data Murid. Minta Owner buat
            hubungkan lewat halaman Accounts.
          </div>
        </div>
      );
    }

    const { data: student } = await supabase
      .from("students")
      .select("class_id, class_name")
      .eq("id", profile.student_id)
      .maybeSingle();

    const { data: materials } = student?.class_id
      ? await supabase
          .from("materials")
          .select("id, title, description, file_url, file_name, teacher_name, created_at")
          .eq("class_id", student.class_id)
          .order("created_at", { ascending: false })
      : { data: [] };

    return (
      <div>
        <h1 className="text-3xl font-extrabold text-bmos-text mb-1">Materi</h1>
        {student?.class_name && (
          <p className="text-bmos-text-light text-sm mb-6">{student.class_name}</p>
        )}

        <div className="bg-white border border-bmos-border rounded-2xl p-6">
          {(materials ?? []).length === 0 ? (
            <p className="text-sm text-bmos-text-light text-center py-8">
              Belum ada materi buat kelas kamu.
            </p>
          ) : (
            <div className="space-y-3">
              {(materials ?? []).map((m) => (
                <div
                  key={m.id}
                  className="border-b border-bmos-border last:border-0 pb-3 last:pb-0"
                >
                  <p className="text-sm font-semibold text-bmos-text">{m.title}</p>
                  <p className="text-xs text-bmos-text-light">{m.teacher_name}</p>
                  {m.description && (
                    <p className="text-sm text-bmos-text-light mt-1">
                      {m.description}
                    </p>
                  )}
                  <a
                    href={m.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-bmos-primary hover:underline mt-1 inline-block"
                  >
                    📎 {m.file_name || "Buka file"}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== LAOSHI: upload/hapus materi ke kelas dia sendiri =====
  if (isTeacher && !isStaff) {
    if (!profile.teacher_id) {
      return (
        <div>
          <h1 className="text-3xl font-extrabold text-bmos-text mb-4">Materi</h1>
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
            Akun kamu belum dihubungkan ke data Laoshi. Minta Owner buat
            hubungkan lewat halaman Accounts.
          </div>
        </div>
      );
    }

    const { data: classes } = await supabase
      .from("classes")
      .select("id, name")
      .eq("teacher_id", profile.teacher_id)
      .order("name");

    const classIds = (classes ?? []).map((c) => c.id);

    const { data: materials } = classIds.length
      ? await supabase
          .from("materials")
          .select(
            "id, class_id, class_name, teacher_id, teacher_name, title, description, file_url, file_name, created_at"
          )
          .in("class_id", classIds)
          .order("created_at", { ascending: false })
      : { data: [] };

    return (
      <div>
        <h1 className="text-3xl font-extrabold text-bmos-text mb-6">Materi</h1>
        <MaterialsManage
          classes={classes ?? []}
          materials={materials ?? []}
          isStaff={false}
          myTeacherId={profile.teacher_id}
        />
      </div>
    );
  }

  // ===== OWNER/ADMIN: lihat & kelola semua materi di semua kelas =====
  if (isStaff) {
    const [{ data: classes }, { data: materials }] = await Promise.all([
      supabase.from("classes").select("id, name").order("name"),
      supabase
        .from("materials")
        .select(
          "id, class_id, class_name, teacher_id, teacher_name, title, description, file_url, file_name, created_at"
        )
        .order("created_at", { ascending: false }),
    ]);

    return (
      <div>
        <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
          Admin
        </p>
        <h1 className="text-3xl font-extrabold text-bmos-text mb-6">Materi</h1>
        <MaterialsManage
          classes={classes ?? []}
          materials={materials ?? []}
          isStaff={true}
          myTeacherId={null}
        />
      </div>
    );
  }

  redirect("/");
}
