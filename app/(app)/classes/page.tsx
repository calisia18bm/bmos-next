import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import AddClassButton from "./AddClassButton";
import EditClassButton from "./EditClassButton";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const isStaff = profile.roles.includes("OWNER") || profile.roles.includes("ADMIN");
  if (!isStaff) redirect("/");

  const supabase = await createClient();

  const [{ data: classes }, { data: teachers }] = await Promise.all([
    // Kelas yang disubmit Laoshi lewat "Buat Kelas" cuma keliatan di sini
    // SETELAH di-approve Owner (approval_status APPROVED) -- yang masih
    // Menunggu/Ditolak ada di menu "Approval Kelas". Kelas yang dibikin
    // langsung dari sini (tombol "+ Tambah Kelas") otomatis APPROVED.
    supabase
      .from("classes")
      .select("*")
      .eq("approval_status", "APPROVED")
      .order("created_at", { ascending: false }),
    supabase.from("teachers").select("id, name").eq("active", true),
  ]);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Master Data
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text">Classes</h1>
          <p className="text-bmos-text-light text-sm mt-1">
            Kelola jadwal dan kapasitas kelas.
          </p>
        </div>
        <AddClassButton teachers={teachers ?? []} />
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-bmos-text-light border-b border-bmos-border">
              <th className="px-5 py-3 font-medium">Kelas</th>
              <th className="px-5 py-3 font-medium">Laoshi</th>
              <th className="px-5 py-3 font-medium">Jadwal</th>
              <th className="px-5 py-3 font-medium">Kapasitas</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {(classes ?? []).map((c) => (
              <tr key={c.id} className="border-b border-bmos-border last:border-0">
                <td className="px-5 py-3">
                  <p className="font-semibold text-bmos-text">{c.name}</p>
                  <p className="text-xs text-bmos-text-light">
                    {c.class_code}
                    {c.created_by_teacher_id && (
                      <span className="ml-1.5 inline-block bg-bmos-primary-soft text-bmos-primary px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                        🗂️ dari Laoshi
                      </span>
                    )}
                  </p>
                </td>
                <td className="px-5 py-3 text-bmos-text">
                  {c.teacher_name || "-"}
                </td>
                <td className="px-5 py-3 text-bmos-text">
                  {c.day_of_week
                    ? `${c.day_of_week} · ${c.start_time?.slice(0, 5) || ""}-${
                        c.end_time?.slice(0, 5) || ""
                      }`
                    : "-"}
                </td>
                <td className="px-5 py-3 text-bmos-text">
                  {c.capacity_max}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                      c.active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {c.active ? "Aktif" : "Non-Aktif"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <EditClassButton cls={c} teachers={teachers ?? []} />
                </td>
              </tr>
            ))}

            {(!classes || classes.length === 0) && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-bmos-text-light"
                >
                  Belum ada data kelas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
