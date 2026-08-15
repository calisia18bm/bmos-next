// Menu di sini HANYA yang halamannya udah beneran dibangun.
// Setiap kali nambah halaman baru, tambahin menu key-nya di sini juga.
export const ROLE_MENU_ACCESS: Record<string, string[]> = {
  OWNER: ["dashboard", "students", "teachers", "classes", "attendance"],
  ADMIN: ["dashboard", "students", "teachers", "classes", "attendance"],
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
