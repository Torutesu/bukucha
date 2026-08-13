"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomTab } from "@/components/BottomTab";
import { PlotGridCard, type CardData } from "@/components/SituationCard";
import { brand } from "@/lib/theme";

interface Section {
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
export default function HomePage() {
  const router = useRouter();
  const [sections, setSections] = useState<Section[] | null>(null);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [me, setMe] = useState<{ safeFilterOff: boolean } | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<TabKey>("forYou");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagResults, setTagResults] = useState<{ key: string; items: CardData[] } | null>(null);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/me");
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      if (!meData && !localStorage.getItem("bukucha_visited")) {
        router.replace("/welcome");
        return;
      }
      try {
        const [homeRes, tagsRes] = await Promise.all([
          fetch("/api/home"),
          fetch("/api/tags?category=desire"),
        ]);
        setSections((await homeRes.json()).sections);
        setTags(await tagsRes.json());
      } catch {
        setError(true);
      }
    })();
  }, [router]);

  // タグチップはZeta同様その場でグリッドを絞り込む
  useEffect(() => {
    if (!activeTag) return;
    const key = `${activeTag}:${tab}`;
    (async () => {
      try {
        const r = await fetch(
          `/api/search?tags=${encodeURIComponent(activeTag)}&sort=${tab === "new" ? "new" : "popular"}`
        );
        const j = await r.json();
        setTagResults({ key, items: j.items });
      } catch {
        /* 全体表示にフォールバック */
      }
    })();
  }, [activeTag, tab]);

  const gridItems: CardData[] | null = activeTag
    ? tagResults?.key === `${activeTag}:${tab}`
      ? tagResults.items
      : null
    : (sections?.find((s) => s.key === tab)?.situations ?? (sections ? [] : null));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b" style={{ background: "color-mix(in oklab, var(--c-bg) 94%, transparent)", backdropFilter: "blur(8px)", borderColor: "var(--c-border)" }}>
        <div className="flex items-center justify-between px-4 pt-3">
          <h1 className="text-lg font-bold" style={{ color: "var(--c-primary)" }}>
            {brand.name}
          </h1>
          <Link href="/search" aria-label="検索" className="pressable text-xl">
            🔍
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
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                style={{ background: tab === t.key ? "var(--c-primary)" : "transparent" }}
              />
            </button>
          ))}
        </nav>
      </header>

      {/* カテゴリチップ(その場絞り込み) */}
      <div data-testid="home-tags" className="hide-scrollbar flex gap-2 overflow-x-auto px-4 pt-3">
        <button className="chip" data-on={activeTag === null} onClick={() => setActiveTag(null)}>
          全体
        </button>
        {tags.map((t) => (
          <button
            key={t.id}
            className="chip"
            data-on={activeTag === t.name}
            onClick={() => setActiveTag(activeTag === t.name ? null : t.name)}
          >
            {t.name}
          </button>
        ))}
      </div>

      {me !== undefined && (!me || !me.safeFilterOff) && (
        <Link
          href="/settings"
          data-testid="safe-filter-banner"
          className="mx-4 mt-2 block rounded-lg px-3 py-1.5 text-[11px]"
          style={{ background: "var(--c-primarySoft)", color: "var(--c-primary)" }}
        >
          🛡 安心フィルターを適用しています
        </Link>
      )}

      <main className="flex-1 px-4 pb-6 pt-3">
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
      </main>
      <BottomTab />
    </div>
  );
}
