"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CharacterPicker from "./CharacterPicker";
import ChangePasswordButton from "./ChangePasswordButton";

const NAV_GROUPS = [
  {
    label: "MAIN",
    items: [{ href: "/", menu: "dashboard", label: "Home", icon: "📊" }],
  },
  {
    label: "PORTAL MURID",
    items: [
      { href: "/my-class", menu: "my-class", label: "My Class", icon: "📖" },
      {
        href: "/my-attendance",
        menu: "my-attendance",
        label: "My Attendance",
        icon: "✅",
      },
      {
        href: "/my-payments",
        menu: "my-payments",
        label: "My Payments",
        icon: "💳",
      },
    ],
  },
  {
    label: "PORTAL LAOSHI",
    items: [
      {
        href: "/my-students",
        menu: "my-students",
        label: "My Students",
        icon: "🧑‍🎓",
      },
    ],
  },
  {
    label: "MASTER",
    items: [
      { href: "/students", menu: "students", label: "Students", icon: "🧑‍🎓" },
      { href: "/teachers", menu: "teachers", label: "Teachers", icon: "👩‍🏫" },
      { href: "/classes", menu: "classes", label: "Classes", icon: "📚" },
      { href: "/accounts", menu: "accounts", label: "Accounts", icon: "🔑" },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      {
        href: "/attendance",
        menu: "attendance",
        label: "Attendance",
        icon: "✅",
      },
      { href: "/payments", menu: "payments", label: "Payments", icon: "💳" },
      { href: "/payroll", menu: "payroll", label: "Payroll", icon: "🏦" },
      { href: "/expenses", menu: "expenses", label: "Expenses", icon: "🧾" },
    ],
  },
  {
    label: "CRM",
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
    label: "SCHEDULE",
    items: [
      {
        href: "/weekly-schedule",
        menu: "weekly-schedule",
        label: "Weekly Schedule",
        icon: "🗓️",
      },
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
    label: "REPORT",
    items: [
      { href: "/reports", menu: "reports", label: "Reports", icon: "📈" },
    ],
  },
  {
    label: "SYSTEM",
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
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-bmos-border h-screen fixed inset-y-0 left-0 flex flex-col z-20">
      <div className="p-5 flex items-center gap-3 border-b border-bmos-border">
        <CharacterPicker characterKey={characterKey} canEdit={roles.includes("OWNER")} />
        <div>
          <p className="font-extrabold text-bmos-text leading-tight">BMOS</p>
          <p className="text-xs text-bmos-text-light">BM Mandarin</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-5">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) =>
            menus.includes(item.menu)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              <p className="text-[11px] font-bold tracking-wide text-bmos-text-light mb-2 px-2">
                {group.label}
              </p>
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${
                        active
                          ? "bg-bmos-primary text-white font-semibold"
                          : "text-bmos-text hover:bg-bmos-primary-soft"
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

      <div className="p-4 border-t border-bmos-border">
        <p className="text-xs text-bmos-text-light truncate mb-1">{email}</p>
        <p className="text-[11px] text-bmos-primary font-semibold mb-2">
          {roles.join(", ")}
        </p>
        <ChangePasswordButton />
        <button
          onClick={handleLogout}
          className="w-full text-sm text-bmos-text-light hover:text-bmos-text text-left px-2 py-2"
        >
          Keluar
        </button>
      </div>
    </aside>
  );
}
