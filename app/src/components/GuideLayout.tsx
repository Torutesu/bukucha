import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { Logo } from "@/components/Logo";

export function GuideLayout({
  children,
  breadcrumbs,
}: {
  children: ReactNode;
  breadcrumbs: { label: string; href?: string }[];
}) {
  return (
    <>
      <header className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--c-border)" }}>
        <Link href="/" aria-label="Bukucha ホーム"><Logo /></Link>
        <Link href="/" className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--c-primary)" }}>
          物語を探す <ArrowUpRight size={14} aria-hidden />
        </Link>
      </header>
      <main className="px-5 pb-10 pt-5">
        <nav aria-label="パンくずリスト" className="mb-8 text-[11px] leading-relaxed" style={{ color: "var(--c-textMuted)" }}>
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <li><Link href="/" className="underline underline-offset-2">ホーム</Link></li>
            {breadcrumbs.map((crumb) => (
              <li key={crumb.label} className="inline-flex items-center gap-1.5">
                <ChevronRight size={11} aria-hidden />
                {crumb.href ? <Link href={crumb.href} className="underline underline-offset-2">{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
        {children}
      </main>
      <footer className="border-t px-5 py-6 text-xs leading-relaxed" style={{ borderColor: "var(--c-border)", color: "var(--c-textMuted)" }}>
        <nav aria-label="サイト情報" className="flex flex-wrap gap-x-4 gap-y-3">
          <Link href="/about">Bukuchaについて</Link>
          <Link href="/guides">楽しみ方ガイド</Link>
          <Link href="/legal/guideline">投稿・表現ガイドライン</Link>
          <Link href="/legal/terms">利用規約</Link>
          <Link href="/legal/privacy">プライバシー</Link>
        </nav>
      </footer>
    </>
  );
}

export function GuideCta({ label, href, description }: { label: string; href: string; description: string }) {
  return (
    <aside className="mt-10 rounded-2xl border p-5" style={{ borderColor: "var(--c-border)", background: "var(--c-primarySoft)" }}>
      <p className="mb-4 text-sm leading-relaxed">{description}</p>
      <Link href={href} className="btn-primary flex items-center justify-center gap-2 text-sm">
        {label} <ArrowUpRight size={16} aria-hidden />
      </Link>
    </aside>
  );
}
