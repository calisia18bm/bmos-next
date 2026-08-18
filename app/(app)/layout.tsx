import Sidebar from "@/components/Sidebar";
import { getCurrentProfile } from "@/lib/auth";
import { getMenusForRoles } from "@/lib/permissions";
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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        roles={profile.roles}
        menus={menus}
        email={profile.email}
        characterKey={profile.character_key}
      />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
