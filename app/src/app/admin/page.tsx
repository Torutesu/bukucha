"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "./ui";

interface Overview {
  openReports: number;
  flagged: number;
  published: number;
  suspended: number;
  users: number;
  banned: number;
}

export default function AdminHome() {
  const [ov, setOv] = useState<Overview | null>(null);

  useEffect(() => {
    adminFetch("/api/admin/overview").then(setOv).catch(() => {});
  }, []);

  if (!ov) return <div className="card h-32 animate-pulse" />;

  const stats: { label: string; value: number; href: string; urgent?: boolean }[] = [
    { label: "未対応の通報", value: ov.openReports, href: "/admin/reports", urgent: ov.openReports > 0 },
    { label: "未レビューの審査フラグ", value: ov.flagged, href: "/admin/flags", urgent: ov.flagged > 0 },
    { label: "公開中の作品", value: ov.published, href: "/admin/situations" },
    { label: "停止中の作品", value: ov.suspended, href: "/admin/situations" },
    { label: "ユーザー数", value: ov.users, href: "/admin/users" },
    { label: "BAN中", value: ov.banned, href: "/admin/users" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3" data-testid="admin-overview">
      {stats.map((s) => (
        <Link key={s.label} href={s.href} className="card block p-4">
          <p className="text-xs" style={{ color: "var(--c-textMuted)" }}>
            {s.label}
          </p>
          <p
            className="mt-1 text-2xl font-bold"
            style={s.urgent ? { color: "var(--c-primary)" } : undefined}
          >
            {s.value}
          </p>
        </Link>
      ))}
    </div>
  );
}
