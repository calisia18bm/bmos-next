import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import AddAccountButton from "./AddAccountButton";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  TEACHER: "Laoshi",
  STUDENT: "Murid",
};

export default async function AccountsPage() {
  const profile = await getCurrentProfile();
  const canView =
    profile?.roles?.includes("OWNER") || profile?.roles?.includes("ADMIN");

  if (!canView) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: accounts } = await supabase
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
              </tr>
            ))}

            {(!accounts || accounts.length === 0) && (
              <tr>
                <td
                  colSpan={4}
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
