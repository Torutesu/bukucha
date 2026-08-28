"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Discover", icon: "◎" },
  { href: "/library", label: "Library", icon: "▤" },
  { href: "/create", label: "Create", icon: "+" },
  { href: "/me", label: "You", icon: "◍" },
];

export function BottomTab() {
  const pathname = usePathname();
  return (
    <nav
      data-testid="bottom-tab"
      className="sticky bottom-0 z-20 grid grid-cols-4 border-t"
      style={{ background: "var(--c-surface)", borderColor: "var(--c-border)" }}
    >
      {TABS.map((t) => {
        const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className="flex flex-col items-center gap-0.5 py-2 text-xs"
            style={{ color: active ? "var(--c-primary)" : "var(--c-textMuted)" }}
          >
            <span aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
