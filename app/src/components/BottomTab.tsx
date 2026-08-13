"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, SquarePen, User } from "lucide-react";

const TABS = [
  { href: "/", label: "ホーム", Icon: Home },
  { href: "/bookshelf", label: "本棚", Icon: Library },
  { href: "/create", label: "作る", Icon: SquarePen },
  { href: "/me", label: "マイ", Icon: User },
];

export function BottomTab() {
  const pathname = usePathname();
  return (
    <nav
      data-testid="bottom-tab"
      className="sticky bottom-0 z-20 grid grid-cols-4 border-t"
      style={{
        background: "color-mix(in oklab, var(--c-surface) 92%, transparent)",
        borderColor: "var(--c-border)",
        backdropFilter: "blur(8px)",
      }}
    >
      {TABS.map((t) => {
        const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className="pressable flex flex-col items-center gap-0.5 py-2 text-xs"
            style={{
              color: active ? "var(--c-primary)" : "var(--c-textMuted)",
              fontWeight: active ? 600 : 400,
              transition: "color 0.2s ease",
            }}
          >
            <t.Icon aria-hidden size={20} strokeWidth={1.8} />
            <span>{t.label}</span>
            <span
              aria-hidden
              className="h-1 w-1 rounded-full"
              style={{ background: active ? "var(--c-primary)" : "transparent" }}
            />
          </Link>
        );
      })}
    </nav>
  );
}
