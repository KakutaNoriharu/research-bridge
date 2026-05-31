"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード", icon: "🏠" },
  { href: "/search", label: "検索", icon: "🔍" },
  { href: "/matches", label: "マッチング", icon: "🤝" },
  { href: "/interests", label: "インタレスト", icon: "⭐" },
  { href: "/messages", label: "メッセージ", icon: "💬" },
  { href: "/profile/edit", label: "プロフィール", icon: "👤" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 flex-col bg-sidebar-bg py-6">
      <ul className="flex flex-col gap-1 px-3">
        {navItems.map(({ href, label, icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary-600 text-white"
                    : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active"
                }`}
              >
                <span>{icon}</span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
