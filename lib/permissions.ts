export const ROLE_MENU_ACCESS: Record<string, string[]> = {
  OWNER: [
    "dashboard",
    "students",
    "teachers",
    "classes",
    "attendance",
    "payments",
    "payroll",
    "my-class",
    "my-attendance",
    "my-payments",
    "my-students",
  ],
  ADMIN: ["dashboard", "students", "teachers", "classes", "attendance", "payments"],
  TEACHER: ["dashboard", "attendance", "my-students"],
  STUDENT: ["dashboard", "my-class", "my-attendance", "my-payments"],
};

export function getMenusForRoles(roles: string[]): string[] {
  const menus = new Set<string>();
  roles.forEach((role) => {
    (ROLE_MENU_ACCESS[role] || []).forEach((menu) => menus.add(menu));
  });
  return Array.from(menus);
}
