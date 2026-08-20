// Menu di sini HANYA yang halamannya udah beneran dibangun.
// Setiap kali nambah halaman baru, tambahin menu key-nya di sini juga.
export const ROLE_MENU_ACCESS: Record<string, string[]> = {
  // Owner sengaja dikasih SEMUA menu, termasuk menu "portal" punya
  // Murid/Laoshi (my-class, my-schedule, dst) -- biar Owner bisa buka
  // & cek sendiri tampilan tiap role dari sidebar-nya, buat mastiin
  // ga ada yang error/aneh.
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
    "materials",
    "my-class",
    "my-payments",
    "my-schedule",
    "my-students",
    "my-payroll",
  ],
  ADMIN: [
    "dashboard",
    "students",
    "teachers",
    "classes",
    "attendance",
    "payments",
    "payroll",
    "expenses",
    "weekly-schedule",
    "weekly-choice",
    "content-calendar",
    "materials",
    // "accounts" sengaja DIHAPUS dari sini -- pengelolaan akun (buat/edit
    // akun, reset password orang lain) sekarang cuma buat Owner.
  ],
  TEACHER: [
    "dashboard",
    "attendance",
    "my-schedule",
    "my-students",
    "materials",
    "my-payroll",
  ],
  STUDENT: ["dashboard", "my-class", "my-payments", "materials"],
};

export function getMenusForRoles(roles: string[]): string[] {
  const menus = new Set<string>();
  roles.forEach((role) => {
    (ROLE_MENU_ACCESS[role] || []).forEach((menu) => menus.add(menu));
  });
  return Array.from(menus);
}
