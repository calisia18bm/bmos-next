import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import AddAccountButton from "./AddAccountButton";
import EditAccountButton from "./EditAccountButton";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  TEACHER: "Laoshi",
  STUDENT: "Murid",
};

export default async function AccountsPage() {
  const profile = await getCurrentProfile();
  // Pengelolaan akun (bikin/edit akun, reset password orang lain) cuma
  // buat Owner -- Admin ga boleh lagi masuk ke sini.
  const canView = profile?.roles?.includes("OWNER") ?? false;

  if (!canView) {
    redirect("/");
  }

  // Pakai admin client (service role) buat list akun -- soalnya RLS di
  // user_profiles cuma ngizinin tiap user baca baris punya sendiri
  // (lihat database/fix_rls.sql). Halaman ini sendiri sudah dijaga di
  // atas (cuma OWNER yang boleh render), jadi aman pakai service role
  // di sini buat nampilin SEMUA akun, bukan cuma punya sendiri.
  const admin = createAdminClient();
  const { data: accounts } = await admin
    .from("user_profiles")
    .select("id, email, full_name, roles, active_role, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
            Master Data
          </p>
          <h1 className="text-3xl font-extrabold text-bmos-text">Accounts</h1>
          <p className="text-bmos-text-light text-sm mt-1">
            Kelola akun login BMOS untuk owner, admin, laoshi, dan murid.
          </p>
        </div>
        <AddAccountButton />
      </div>

      <div className="bg-white border border-bmos-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-bmos-text-light border-b border-bmos-border">
              <th className="px-5 py-3 font-medium">Nama</th>
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Terdaftar</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(accounts ?? []).map((a) => (
              <tr
                key={a.id}
                className="border-b border-bmos-border last:border-0"
              >
                <td className="px-5 py-3 font-semibold text-bmos-text">
                  {a.full_name || "-"}
                </td>
                <td className="px-5 py-3 text-bmos-text">{a.email}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(a.roles || []).map((r: string) => (
                      <span
                        key={r}
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-bmos-primary-soft text-bmos-primary"
                      >
                        {ROLE_LABEL[r] || r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3 text-bmos-text-light text-xs">
                  {a.created_at
                    ? new Date(a.created_at).toLocaleDateString("id-ID")
                    : "-"}
                </td>
                <td className="px-5 py-3 text-right">
                  <EditAccountButton
                    account={{
                      id: a.id,
                      email: a.email,
                      full_name: a.full_name,
                      roles: a.roles || [],
                    }}
                  />
                </td>
              </tr>
            ))}

            {(!accounts || accounts.length === 0) && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-10 text-center text-bmos-text-light"
                >
                  Belum ada akun. Klik &quot;Buat Akun&quot; untuk mulai.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
