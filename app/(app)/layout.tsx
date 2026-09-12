import Sidebar from "@/components/Sidebar";
import BmLogoBadge from "@/components/BmLogoBadge";
import { getCurrentProfile } from "@/lib/auth";
import { getMenusForRoles } from "@/lib/permissions";
import { getPendingClassCardCount } from "./class-cards/actions";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/no-access");
  }

  const menus = getMenusForRoles(profile.roles);
  // Badge notif "Approval Kelas" di sidebar -- getPendingClassCardCount
  // sendiri udah ngecek role (cuma Owner/Admin yang dapet angka > 0),
  // jadi aman dipanggil di sini buat semua role.
  const pendingClassCardCount = await getPendingClassCardCount();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        roles={profile.roles}
        menus={menus}
        email={profile.email}
        characterKey={profile.character_key}
        pendingClassCardCount={pendingClassCardCount}
      />
      <main className="flex-1 p-8 ml-64">{children}</main>
      <BmLogoBadge />
    </div>
  );
}
