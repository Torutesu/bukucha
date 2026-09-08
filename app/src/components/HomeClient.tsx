"use client";
import { Search } from "lucide-react";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomTab } from "@/components/BottomTab";
import { PlotGridCard, type CardData } from "@/components/SituationCard";
import { Logo } from "@/components/Logo";

export interface HomeSection {
  key: string;
  title: string;
  situations: CardData[];
}

// ホームのタブ(Zeta型: トレンド/ベスト/新作)。keyは/api/homeのセクションkeyに対応
const HOME_TABS = [
  { key: "forYou", label: "トレンド" },
  { key: "popular", label: "ベスト" },
  { key: "new", label: "新作" },
] as const;
type TabKey = (typeof HOME_TABS)[number]["key"];

// SCR-002: ホーム(Zeta型グリッド)
export default function HomeClient({ initialSections, initialTags, children }: {
  initialSections: HomeSection[];
  initialTags: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const [sections, setSections] = useState<HomeSection[]>(initialSections);
  const [tags, setTags] = useState(initialTags);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<TabKey>("forYou");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagResults, setTagResults] = useState<{ key: string; items: CardData[] } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    // The first render is the public catalogue; apply the reader's settings after hydration.
    (async () => {
      try {
        const [homeRes, tagsRes] = await Promise.all([
          fetch("/api/home", { signal: controller.signal }),
          fetch("/api/tags?category=desire", { signal: controller.signal }),
        ]);
        if (!homeRes.ok || !tagsRes.ok) return;
        const [home, nextTags] = await Promise.all([homeRes.json(), tagsRes.json()]);
        if (!controller.signal.aborted) {
          setSections(home.sections);
          setTags(nextTags);
        }
      } catch { /* The server-rendered catalogue remains usable on connection failure. */ }
    })();
    return () => controller.abort();
  }, []);

  // Discard obsolete tag responses when the reader changes the selection quickly.
  useEffect(() => {
    if (!activeTag) return;
    const controller = new AbortController();
    const key = `${activeTag}:${tab}`;
    (async () => {
      try {
        const r = await fetch(
          `/api/search?tags=${encodeURIComponent(activeTag)}&sort=${tab === "new" ? "new" : "popular"}`,
          { signal: controller.signal },
        );
        if (!r.ok) throw new Error("Search unavailable");
        const j = await r.json();
        if (!controller.signal.aborted) {
          setError(false);
          setTagResults({ key, items: j.items });
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    })();
    return () => controller.abort();
  }, [activeTag, tab]);

  const gridItems: CardData[] | null = activeTag
    ? tagResults?.key === `${activeTag}:${tab}`
      ? tagResults.items
      : null
    : (sections?.find((s) => s.key === tab)?.situations ?? (sections ? [] : null));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="app-header">
        <div className="flex items-center justify-between px-4 pt-3">
          <Link href="/" aria-label="Bukucha ホーム">
            <Logo size={26} wordSize="1.1rem" />
          </Link>
          <Link href="/search" aria-label="検索" className="pressable p-1">
            <Search size={20} strokeWidth={1.8} />
          </Link>
        </div>

        {/* トレンド / ベスト / 新作 */}
        <nav className="mt-1 flex gap-5 px-4">
          {HOME_TABS.map((t) => (
            <button
              key={t.key}
              data-testid={`tab-${t.key}`}
              className="relative pb-2 text-[0.95rem] font-bold"
              style={{ color: tab === t.key ? "var(--c-text)" : "var(--c-textMuted)", transition: "color 0.2s ease" }}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-px h-[3px] rounded-full"
                style={{
                  background:
                    tab === t.key ? "linear-gradient(90deg, var(--c-primary), var(--c-accent))" : "transparent",
                }}
              />
            </button>
          ))}
        </nav>
      </header>

      {/* カテゴリチップ(その場絞り込み) */}
      <div data-testid="home-tags" className="hide-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 pt-3">
        <button className="chip" data-on={activeTag === null} onClick={() => { setActiveTag(null); setError(false); }}>
          全体
        </button>
        {tags.map((t) => (
          <button
            key={t.id}
            className="chip"
            data-on={activeTag === t.name}
            onClick={() => { setActiveTag(activeTag === t.name ? null : t.name); setError(false); }}
          >
            {t.name}
          </button>
        ))}
      </div>

      <main className="flex-1 px-4 pb-6 pt-3">
        <section className="mb-5 space-y-2" aria-label="Bukuchaについて">
          <h1 className="text-lg font-bold leading-snug">AIとつむぐ、あなただけの恋愛小説</h1>
          <p className="text-xs leading-relaxed" style={{ color: "var(--c-textMuted)" }}>Bukuchaは、シチュエーションから物語に入る女性向けノベルAIチャット。オリジナルの登場人物と会話し、選択や言葉で続きを一緒に作れます。</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs" style={{ color: "var(--c-primary)" }}>
            <Link href="/welcome">好みから物語を選ぶ</Link>
            <Link href="/guides/ai-novel-chat">はじめての方へ</Link>
          </div>
        </section>
        {error && (
          <div className="card p-4 text-center text-sm">
            読み込みに失敗しました
            <button className="btn-ghost mt-2 w-full" onClick={() => location.reload()}>
              再試行
            </button>
          </div>
        )}
        {!error && !gridItems && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton aspect-[3/4] rounded-[14px]" />
                <div className="skeleton h-4 w-11/12" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            ))}
          </div>
        )}
        {gridItems && gridItems.length === 0 && (
          <p className="py-10 text-center text-xs" style={{ color: "var(--c-textMuted)" }}>
            該当する物語がまだありません
          </p>
        )}
        {gridItems && gridItems.length > 0 && (
          <div data-testid={`section-${tab}`} className="grid grid-cols-2 gap-x-3 gap-y-5">
            {gridItems.map((s, i) => (
              <PlotGridCard key={s.id} s={s} rank={tab !== "new" && !activeTag ? i + 1 : undefined} />
            ))}
          </div>
        )}
        {children}
      </main>
      <BottomTab />
    </div>
  );
}
