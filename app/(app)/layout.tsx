import Sidebar from "@/components/Sidebar";
import BmLogoBadge from "@/components/BmLogoBadge";
import { getCurrentProfile } from "@/lib/auth";
import { getMenusForRoles } from "@/lib/permissions";
import { getPendingClassCardCount, getUnseenClassCardStatusCount } from "./class-cards/actions";
import { getUnreadAnnouncementCount } from "./announcements/actions";
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
  // Badge notif angka di sidebar -- masing-masing fungsi udah ngecek role
  // sendiri (jadi role yang ga relevan selalu dapet 0), aman dipanggil
  // bareng buat semua role:
  // - pendingClassCardCount: Class Card nunggu di-approve (Owner/Admin).
  // - unseenClassCardStatusCount: Class Card punya Laoshi sendiri yang
  //   baru di-approve/di-reject tapi belum sempat dia buka (Laoshi).
  // - unreadAnnouncementCount: Pengumuman yang belum dibuka (Laoshi/
  //   Murid/Admin -- Owner ga punya widget Pengumuman jadi selalu 0).
  const [pendingClassCardCount, unseenClassCardStatusCount, unreadAnnouncementCount] =
    await Promise.all([
      getPendingClassCardCount(),
      getUnseenClassCardStatusCount(),
      getUnreadAnnouncementCount(),
    ]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        roles={profile.roles}
        menus={menus}
        email={profile.email}
        characterKey={profile.character_key}
        pendingClassCardCount={pendingClassCardCount}
        unseenClassCardStatusCount={unseenClassCardStatusCount}
        unreadAnnouncementCount={unreadAnnouncementCount}
      />
      <main className="flex-1 p-8 ml-64">{children}</main>
      <BmLogoBadge />
    </div>
  );
}
