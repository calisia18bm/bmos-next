// Menu di sini HANYA yang halamannya udah beneran dibangun.
// Setiap kali nambah halaman baru, tambahin menu key-nya di sini juga.
export const ROLE_MENU_ACCESS: Record<string, string[]> = {
  OWNER: [
    "dashboard",
    "students",
    "teachers",
    "classes",
    "attendance",
    "payments",
    "payroll",
    "leads",
    "trials",
    "follow-up",
    "content-calendar",
    "weekly-schedule",
    "weekly-choice",
    "expenses",
    "reports",
    "ai-assistant",
    "branding",
    "accounts",
  ],
  ADMIN: [
    "dashboard",
    "students",
    "teachers",
    "classes",
    "attendance",
    "payments",
    // "accounts" sengaja DIHAPUS dari sini -- pengelolaan akun (buat/edit
    // akun, reset password orang lain) sekarang cuma buat Owner.
  ],
  TEACHER: ["dashboard", "attendance"],
  STUDENT: ["dashboard"],
};

export function getMenusForRoles(roles: string[]): string[] {
  const menus = new Set<string>();
  roles.forEach((role) => {
    (ROLE_MENU_ACCESS[role] || []).forEach((menu) => menus.add(menu));
  });
  return Array.from(menus);
}
