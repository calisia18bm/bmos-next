import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import MaterialsManage from "./MaterialsManage";

export const dynamic = "force-dynamic";

// Owner/Admin liat SEMUA bagian sidebar (Murid/Laoshi/Admin) sekaligus di
// akun mereka sendiri, biar gampang ngecek kalau ada yang error -- tapi
// sebelumnya link "Materi" di bagian MURID & LAOSHI itu nunjuk ke URL yang
// SAMA, jadi buat Owner selalu kebuka tampilan Admin (bisa upload),
// walaupun yang diklik link "Materi" di bagian Murid. Makanya keliatan
// kayak "murid bisa upload" padahal itu Owner liat versi Admin-nya.
//
// Fix: link Materi di MURID & LAOSHI sekarang bawa ?as=student / ?as=teacher,
// dan di sini Owner/Admin dipaksa liat PERSIS tampilan Murid/Laoshi asli
// (read-only buat Murid, ga ada form upload) -- murni buat preview/QA.
// Ini SAMA SEKALI ga ngubah akses akun Murid/Laoshi asli, karena mereka
// login dengan role sendiri, bukan lewat query param ini. Server action
// upload/hapus (actions.ts) juga selalu ngecek role asli si pengguna, jadi
// preview ini ga bisa disalahgunakan buat beneran upload sebagai Murid.
export default async function MaterialsPage({
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

  // Cuma OWNER (BUKAN Admin) yang boleh preview tampilan Murid/Laoshi di
  // sini -- Admin yang buka /materials biasa (tanpa ?as=...) tetap dapet
  // tampilan Admin standar seperti biasa.
  const previewAsStudent = isOwner && as === "student";
  const previewAsTeacher = isOwner && as === "teacher" && !previewAsStudent;

  const supabase = await createClient();

  // ===== MURID: read-only, cuma materi di kelas dia =====
  // (atau Owner/Admin lagi preview tampilan Murid)
  if ((isStudent && !isStaff && !isTeacher) || previewAsStudent) {
    if (!previewAsStudent && !profile.student_id) {
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

    let materials: {
      id: string;
      title: string;
      description: string | null;
      file_url: string;
      file_name: string | null;
      teacher_name: string | null;
      created_at: string;
    }[] = [];
    let className: string | null = null;

    if (previewAsStudent) {
      // Owner/Admin preview -- ga ada murid spesifik, jadi tampilin
      // gabungan materi dari semua kelas biar kebayang isinya.
      const { data } = await supabase
        .from("materials")
        .select("id, title, description, file_url, file_name, teacher_name, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      materials = data ?? [];
    } else {
      const { data: student } = await supabase
        .from("students")
        .select("class_id, class_name")
        .eq("id", profile.student_id!)
        .maybeSingle();
      className = student?.class_name ?? null;

      const { data } = student?.class_id
        ? await supabase
            .from("materials")
            .select("id, title, description, file_url, file_name, teacher_name, created_at")
            .eq("class_id", student.class_id)
            .order("created_at", { ascending: false })
        : { data: [] };
      materials = data ?? [];
    }

    return (
      <div>
        {previewAsStudent && (
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Preview Murid
          </p>
        )}
        <h1 className="text-3xl font-extrabold text-bmos-text mb-1">Materi</h1>
        {className && (
          <p className="text-bmos-text-light text-sm mb-6">{className}</p>
        )}
        {previewAsStudent && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4 text-sm text-blue-800">
            👁️ Preview tampilan Murid -- ini yang beneran dilihat akun Murid
            (ga ada tombol upload).
          </div>
        )}

        <div className="bg-white border border-bmos-border rounded-2xl p-6">
          {materials.length === 0 ? (
            <p className="text-sm text-bmos-text-light text-center py-8">
              Belum ada materi.
            </p>
          ) : (
            <div className="space-y-3">
              {materials.map((m) => (
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
  // (atau Owner/Admin lagi preview tampilan Laoshi)
  if ((isTeacher && !isStaff) || previewAsTeacher) {
    if (!previewAsTeacher && !profile.teacher_id) {
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

    const classesQuery = previewAsTeacher
      ? supabase.from("classes").select("id, name").order("name")
      : supabase
          .from("classes")
          .select("id, name")
          .eq("teacher_id", profile.teacher_id!)
          .order("name");

    const { data: classes } = await classesQuery;
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
        {previewAsTeacher && (
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Preview Laoshi
          </p>
        )}
        <h1 className="text-3xl font-extrabold text-bmos-text mb-1">Materi</h1>
        {previewAsTeacher && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4 text-sm text-blue-800">
            👁️ Preview tampilan Laoshi -- upload/hapus di sini tetap
            beneran kesimpen (login-nya tetap sebagai kamu), cuma buat
            liat tampilannya aja.
          </div>
        )}
        <MaterialsManage
          classes={classes ?? []}
          materials={materials ?? []}
          isStaff={previewAsTeacher}
          myTeacherId={previewAsTeacher ? null : profile.teacher_id}
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
