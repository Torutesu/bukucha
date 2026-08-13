"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomTab } from "@/components/BottomTab";
import { SituationCard, type CardData } from "@/components/SituationCard";
import { brand } from "@/lib/theme";

interface Section {
  key: string;
  title: string;
  situations: CardData[];
}

// SCR-002: ホーム
export default function HomePage() {
  const router = useRouter();
  const [sections, setSections] = useState<Section[] | null>(null);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [me, setMe] = useState<{ safeFilterOff: boolean } | null | undefined>(undefined);
  const [error, setError] = useState(false);

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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 px-4 pb-2 pt-4" style={{ background: "var(--c-bg)" }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: "var(--c-primary)" }}>
            {brand.name}
          </h1>
          <Link href="/me" aria-label="マイページ" className="text-lg">
            👤
          </Link>
        </div>
        <Link
          href="/search"
          className="input mt-2 block text-sm"
          style={{ color: "var(--c-textMuted)" }}
        >
          🔍 どんな物語を読む?
        </Link>
        <div data-testid="home-tags" className="hide-scrollbar mt-2 flex gap-2 overflow-x-auto">
          {tags.map((t) => (
            <button
              key={t.id}
              className="chip"
              onClick={() => router.push(`/search?tags=${encodeURIComponent(t.name)}`)}
            >
              {t.name}
            </button>
          ))}
        </div>
        {me !== undefined && (!me || !me.safeFilterOff) && (
          <Link
            href="/settings"
            data-testid="safe-filter-banner"
            className="mt-2 block rounded-lg px-3 py-1.5 text-[11px]"
            style={{ background: "var(--c-primarySoft)", color: "var(--c-primary)" }}
          >
            🛡 安心フィルターを適用しています
          </Link>
        )}
      </header>

      <main className="flex-1 space-y-6 px-4 pb-6 pt-2">
        {error && (
          <div className="card p-4 text-center text-sm">
            読み込みに失敗しました
            <button className="btn-ghost mt-2 w-full" onClick={() => location.reload()}>
              再試行
            </button>
          </div>
        )}
        {!error &&
          !sections &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton mb-2 h-5 w-32" />
              <div className="flex gap-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="skeleton aspect-[3/4] w-36 rounded-[12px]" />
                ))}
              </div>
            </div>
          ))}
        {sections?.map((sec) => (
          <section key={sec.key} data-testid={`section-${sec.key}`}>
            <h2 className="mb-2 text-base font-bold">{sec.title}</h2>
            {sec.situations.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--c-textMuted)" }}>
                準備中
              </p>
            ) : (
              <div className="hide-scrollbar flex snap-x gap-3 overflow-x-auto pb-1">
                {sec.situations.map((s) => (
                  <SituationCard key={s.id} s={s} />
                ))}
              </div>
            )}
          </section>
        ))}
      </main>
      <BottomTab />
    </div>
  );
}
