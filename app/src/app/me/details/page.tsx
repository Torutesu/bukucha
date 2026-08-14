"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Gift,
  Headphones,
  Heart,
  LogOut,
  Megaphone,
  MessageSquare,
  Palette,
  Settings,
  Ticket,
  UserX,
  VolumeX,
  Ban,
} from "lucide-react";

function Row({
  icon,
  label,
  href,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const inner = (
    <>
      <span style={{ color: danger ? "var(--c-danger)" : "var(--c-textMuted)" }}>{icon}</span>
      <span className="flex-1 text-sm" style={{ color: danger ? "var(--c-danger)" : "var(--c-text)" }}>
        {label}
      </span>
      <ChevronRight size={16} style={{ color: "var(--c-textMuted)" }} />
    </>
  );
  return href ? (
    <Link href={href} className="flex items-center gap-3 px-4 py-3">
      {inner}
    </Link>
  ) : (
    <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={onClick}>
      {inner}
    </button>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden p-0">
      {title && (
        <p className="px-4 pb-1 pt-3 text-[11px] font-semibold" style={{ color: "var(--c-textMuted)" }}>
          {title}
        </p>
      )}
      {children}
    </section>
  );
}

// SCR-014c: 詳細(設定ハブ、Zeta型)
export default function DetailsPage() {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const soon = (label: string) => () => notify(`${label}は準備中です`);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[var(--shell-max)]">
      <header className="app-header flex h-12 items-center gap-1 px-2">
        <button
          aria-label="戻る"
          className="icon-btn"
          onClick={() => {
            if (window.history.length > 2 || document.referrer.startsWith(location.origin))
              router.back();
            else router.push("/me");
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-bold">詳細</h1>
      </header>

      <main className="space-y-4 px-4 py-3 pb-10">
        <Section title="リワード・アクション">
          <Row icon={<Gift size={18} />} label="リワード" onClick={soon("リワード")} />
          <Row icon={<Ticket size={18} />} label="コード入力" onClick={soon("コード入力")} />
        </Section>

        <Section>
          <Row icon={<Headphones size={18} />} label="カスタマーセンター" onClick={soon("カスタマーセンター")} />
          <Row icon={<Megaphone size={18} />} label="お知らせ" onClick={soon("お知らせ")} />
        </Section>

        <Section title="自分の活動">
          <Row icon={<Heart size={18} />} label="プロットへのいいね" href="/me" />
          <Row icon={<MessageSquare size={18} />} label="コメント活動" onClick={soon("コメント活動")} />
        </Section>

        <Section>
          <Row icon={<Palette size={18} />} label="表示テーマ(ライト/ダーク)" href="/settings" />
          <Row icon={<Bell size={18} />} label="通知設定" onClick={soon("通知設定")} />
          <Row icon={<Settings size={18} />} label="アカウント設定" href="/settings" />
        </Section>

        <Section title="ブロック管理">
          <Row icon={<Ban size={18} />} label="ブロックしたプロット" onClick={soon("ブロック管理")} />
          <Row icon={<UserX size={18} />} label="ブロックしたクリエイター" onClick={soon("ブロック管理")} />
          <Row icon={<VolumeX size={18} />} label="非表示にしたコメント" onClick={soon("ブロック管理")} />
        </Section>

        <Section>
          <Row
            icon={<LogOut size={18} />}
            label="ログアウト"
            danger
            onClick={async () => {
              if (!confirm("ログアウトしますか?")) return;
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/");
            }}
          />
        </Section>
      </main>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex justify-center">
          <span className="rounded-full bg-black/80 px-4 py-2 text-xs text-white">{toast}</span>
        </div>
      )}
    </div>
  );
}
