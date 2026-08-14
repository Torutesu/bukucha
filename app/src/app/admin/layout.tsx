"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/admin", label: "概要" },
  { href: "/admin/reports", label: "通報" },
  { href: "/admin/flags", label: "審査" },
  { href: "/admin/situations", label: "作品" },
  { href: "/admin/users", label: "ユーザー" },
  { href: "/admin/audit", label: "ログ" },
];

// 表示ガードのみ(認可の強制は各 /api/admin/* が行う)
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "ok" | "forbidden">("loading");

  useEffect(() => {
    fetch("/api/admin/overview").then((r) => {
      if (r.status === 401) router.replace(`/login?returnTo=${encodeURIComponent("/admin")}`);
      else if (r.status === 403) setState("forbidden");
      else setState("ok");
    });
  }, [router]);

  if (state === "loading")
    return (
      <main className="space-y-4 p-4">
        <div className="card h-16 animate-pulse" />
      </main>
    );
  if (state === "forbidden")
    return (
      <main className="p-8 text-center">
        <p className="text-sm" style={{ color: "var(--c-textMuted)" }}>
          このページを表示する権限がありません
        </p>
        <Link href="/" className="btn-ghost mt-6 inline-block">
          ホームへ戻る
        </Link>
      </main>
    );

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="sticky top-0 z-10 border-b px-4 py-3"
        style={{ background: "var(--c-bg)", borderColor: "var(--c-border)" }}
      >
        <h1 className="text-sm font-bold">運営管理</h1>
        <nav className="mt-2 flex gap-1 overflow-x-auto text-sm" data-testid="admin-nav">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="chip"
              data-on={pathname === n.href}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 space-y-4 p-4">{children}</main>
    </div>
  );
}
