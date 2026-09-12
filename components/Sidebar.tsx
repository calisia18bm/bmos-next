"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CharacterPicker from "./CharacterPicker";
import ChangePasswordButton from "./ChangePasswordButton";

// Sidebar dikelompokin per "sudut pandang" role (Murid / Laoshi / Admin),
// bukan cuma per fitur -- soalnya Owner sengaja dikasih akses ke SEMUA
// menu (lihat lib/permissions.ts), jadi kalau Owner login, dia bakal
// liat KE-3 bagian ini lengkap sekaligus di sidebar-nya sendiri. Ini
// biar Owner gampang ngecek tampilan tiap role tanpa harus punya akun
// terpisah -- kalau ada yang error/aneh langsung keliatan dari sini.
//
// Buat Murid/Laoshi/Admin beneran (bukan Owner), menu yang muncul tetap
// dibatasin sesuai ROLE_MENU_ACCESS masing-masing di lib/permissions.ts
// -- jadi taro "Accounts" di bagian ADMIN di bawah ini AMAN, karena
// Admin asli tetep ga akan liat menu itu (menu key-nya cuma ada di
// daftar OWNER).
// Beberapa menu key (class-cards, materials, homework, attendance) sengaja
// DIPAKAI ULANG di lebih dari satu grup -- misalnya "class-cards" dipakai
// baik di menu Murid ("Class Card") maupun Laoshi ("Class Card") maupun
// Admin ("Approval Kelas"), karena ketiganya ngizinin akses ke halaman yang
// sama tapi tampilannya beda (?as=student / ?as=teacher / polos). Kalau
// filter sidebar cuma ngecek "apa menu ini termasuk yang diizinin buat
// role user", Murid yang menu key-nya kebetulan overlap (class-cards,
// materials, homework) bakal ikut keliatan juga di grup LAOSHI/ADMIN --
// padahal dia bukan Laoshi/Admin. requiredRoles di sini nutup celah itu:
// grupnya sendiri harus cocok sama role asli user dulu, baru item di
// dalamnya dicek lagi ke menu. Owner sengaja dimasukkin ke semua grup biar
// tetap bisa liat & cek tampilan tiap role dari sidebar-nya sendiri.
const NAV_GROUPS = [
  {
    label: "MAIN",
    requiredRoles: null as string[] | null,
    items: [{ href: "/", menu: "dashboard", label: "Home", icon: "📊" }],
  },
  {
    label: "MURID",
    requiredRoles: ["STUDENT", "OWNER"],
    items: [
      { href: "/my-class", menu: "my-class", label: "My Schedule", icon: "🗓️" },
      {
        href: "/class-cards?as=student",
        menu: "class-cards",
        label: "Class Card",
        icon: "🗂️",
      },
      {
        href: "/materials?as=student",
        menu: "materials",
        label: "Materi",
        icon: "📁",
      },
      {
        href: "/homework?as=student",
        menu: "homework",
        label: "PR",
        icon: "✏️",
      },
      {
        href: "/placement-test",
        menu: "placement-test",
        label: "Placement Test",
        icon: "📝",
      },
      {
        href: "/challenge",
        menu: "challenge",
        label: "Challenge 30 Hari",
        icon: "🔥",
      },
      {
        href: "/my-payments",
        menu: "my-payments",
        label: "Payment Saya",
        icon: "💳",
      },
    ],
  },
  {
    label: "LAOSHI",
    requiredRoles: ["TEACHER", "OWNER"],
    items: [
      { href: "/attendance", menu: "attendance", label: "Absensi", icon: "✅" },
      {
        href: "/class-cards?as=teacher",
        menu: "class-cards",
        label: "Class Card",
        icon: "🗂️",
      },
      {
        href: "/my-schedule",
        menu: "my-schedule",
        label: "My Schedule",
        icon: "🗓️",
      },
      {
        href: "/my-students",
        menu: "my-students",
        label: "My Student",
        icon: "🧑‍🎓",
      },
      {
        href: "/materials?as=teacher",
        menu: "materials",
        label: "Materi",
        icon: "📁",
      },
      {
        href: "/homework?as=teacher",
        menu: "homework",
        label: "PR",
        icon: "✏️",
      },
      {
        href: "/my-payroll",
        menu: "my-payroll",
        label: "My Payroll",
        icon: "🏦",
      },
    ],
  },
  {
    label: "ADMIN",
    requiredRoles: ["ADMIN", "OWNER"],
    items: [
      { href: "/students", menu: "students", label: "Students", icon: "🧑‍🎓" },
      { href: "/teachers", menu: "teachers", label: "Teachers", icon: "👩‍🏫" },
      { href: "/classes", menu: "classes", label: "Classes", icon: "📚" },
      {
        href: "/class-cards",
        menu: "class-cards",
        label: "Approval Kelas",
        icon: "🗂️",
      },
      { href: "/materials", menu: "materials", label: "Materi", icon: "📁" },
      { href: "/homework", menu: "homework", label: "PR", icon: "✏️" },
      {
        href: "/placement-test-manage",
        menu: "placement-test-manage",
        label: "Placement Test",
        icon: "📝",
      },
      {
        href: "/vocab-manage",
        menu: "vocab-manage",
        label: "Challenge & Kosakata",
        icon: "🔥",
      },
      { href: "/accounts", menu: "accounts", label: "Accounts", icon: "🔑" },
      {
        href: "/attendance",
        menu: "attendance",
        label: "Attendance",
        icon: "✅",
      },
      {
        href: "/weekly-schedule",
        menu: "weekly-schedule",
        label: "Schedule",
        icon: "🗓️",
      },
      { href: "/payments", menu: "payments", label: "Payments", icon: "💳" },
      { href: "/payroll", menu: "payroll", label: "Payroll", icon: "🏦" },
      { href: "/expenses", menu: "expenses", label: "Expenses", icon: "🧾" },
      {
        href: "/weekly-choice",
        menu: "weekly-choice",
        label: "Weekly Choice",
        icon: "🔄",
      },
      {
        href: "/content-calendar",
        menu: "content-calendar",
        label: "Content Calendar",
        icon: "📅",
      },
    ],
  },
  {
    label: "CRM",
    requiredRoles: ["ADMIN", "OWNER"],
    items: [
      { href: "/leads", menu: "leads", label: "Leads", icon: "📋" },
      { href: "/trials", menu: "trials", label: "Trials", icon: "🎯" },
      {
        href: "/follow-up",
        menu: "follow-up",
        label: "Follow Up",
        icon: "✔️",
      },
    ],
  },
  {
    label: "REPORT",
    requiredRoles: ["ADMIN", "OWNER"],
    items: [
      { href: "/reports", menu: "reports", label: "Reports", icon: "📈" },
    ],
  },
  {
    label: "SYSTEM",
    requiredRoles: ["ADMIN", "OWNER"],
    items: [
      {
        href: "/ai-assistant",
        menu: "ai-assistant",
        label: "AI Assistant",
        icon: "🤖",
      },
    ],
  },
];

export default function Sidebar({
  roles,
  menus,
  email,
  characterKey,
}: {
  roles: string[];
  menus: string[];
  email: string;
  characterKey: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 bg-bmos-sidebar-bg border-r border-bmos-sidebar-border h-screen fixed inset-y-0 left-0 flex flex-col z-20">
      <div className="p-5 flex items-center gap-3 border-b border-bmos-sidebar-border">
        <CharacterPicker characterKey={characterKey} />
        <div>
          <p className="font-extrabold text-bmos-sidebar-text leading-tight">BMOS</p>
          <p className="text-xs text-bmos-sidebar-text-light">BM Mandarin</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-5">
        {NAV_GROUPS.map((group, groupIndex) => {
          // Grup yang punya requiredRoles cuma keliatan kalau role asli
          // user cocok -- ini yang nyegah Murid (yang menu key-nya
          // kebetulan overlap kayak "materials"/"homework") ikut keliatan
          // di grup LAOSHI/ADMIN.
          if (
            group.requiredRoles &&
            !group.requiredRoles.some((r) => roles.includes(r))
          ) {
            return null;
          }

          const visibleItems = group.items.filter((item) =>
            menus.includes(item.menu)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={`${group.label}-${groupIndex}`}>
              <p className="text-[11px] font-bold tracking-wide text-bmos-sidebar-text-light mb-2 px-2">
                {group.label}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item, itemIndex) => {
                  // item.href kadang bawa query (misal "/materials?as=student")
                  // buat beda-in link Materi di tiap bagian, jadi active-nya
                  // dicocokin path + query-nya, bukan cuma path doang.
                  const [itemPath, itemQuery] = item.href.split("?");
                  const active =
                    pathname === itemPath &&
                    searchParams.toString() === (itemQuery || "");
                  return (
                    <Link
                      key={`${item.href}-${itemIndex}`}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                        active
                          ? "bg-bmos-primary text-white font-semibold"
                          : "text-bmos-sidebar-text hover:bg-bmos-sidebar-hover"
                      }`}
                    >
                      <span>{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-bmos-sidebar-border">
        <p className="text-xs text-bmos-sidebar-text-light truncate mb-1">{email}</p>
        <p className="text-[11px] text-bmos-primary-light font-semibold mb-2">
          {roles.join(", ")}
        </p>
        <ChangePasswordButton email={email} />
        <button
          onClick={handleLogout}
          className="w-full text-sm text-bmos-sidebar-text-light hover:text-bmos-sidebar-text text-left px-2 py-2"
        >
          Keluar
        </button>
      </div>
    </aside>
  );
}
