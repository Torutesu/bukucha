"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomTab } from "@/components/BottomTab";
import { Cover } from "@/components/SituationCard";

interface ShelfStory {
  id: string;
  status: "ACTIVE" | "ARCHIVED";
  lastRecap: string | null;
  lastRecapAtIdx: number;
  lastMessageAt: string;
  situation: { id: string; title: string; coverImageUrl: string | null };
  messages: { idx: number; content: string }[];
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${Math.max(1, min)}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d === 1) return "昨日";
  return `${d}日前`;
}

// SCR-007: 本棚
export default function BookshelfPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [shelf, setShelf] = useState<{ tab: string; items: ShelfStory[] } | null>(null);
  const [error, setError] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const setStories = (
    updater: ShelfStory[] | null | ((prev: ShelfStory[] | null) => ShelfStory[] | null)
  ) => {
    setShelf((prev) => {
      const current = prev?.items ?? null;
      const next = typeof updater === "function" ? updater(current) : updater;
      return next ? { tab, items: next } : null;
    });
  };

  const load = async (status: "ACTIVE" | "ARCHIVED") => {
    const r = await fetch(`/api/stories?status=${status}`);
    if (r.status === 401) {
      router.replace(`/login?returnTo=${encodeURIComponent("/bookshelf")}`);
      return;
    }
    if (!r.ok) {
      setError(true);
      return;
    }
    const j = await r.json();
    setShelf({ tab: status, items: j.items });
    // AIF-004: 古いあらすじをバックグラウンド更新
    for (const st of j.items as ShelfStory[]) {
      const latest = st.messages[0]?.idx ?? 0;
      if (!st.lastRecap || st.lastRecapAtIdx < latest - 1) {
        fetch(`/api/stories/${st.id}/recap`, { method: "POST" })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.lastRecap) {
              setStories((prev) =>
                prev?.map((p) => (p.id === st.id ? { ...p, lastRecap: data.lastRecap } : p)) ?? null
              );
            }
          })
          .catch(() => {});
      }
    }
  };

  useEffect(() => {
    (async () => {
      await load(tab);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const stories = shelf && shelf.tab === tab ? shelf.items : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 pt-4">
        <h1 className="text-xl font-bold">本棚</h1>
        <div className="mt-2 flex gap-2">
          <button className="chip" data-on={tab === "ACTIVE"} onClick={() => setTab("ACTIVE")}>
            読んでいる
          </button>
          <button className="chip" data-on={tab === "ARCHIVED"} onClick={() => setTab("ARCHIVED")}>
            完結した
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-3 px-4 py-4">
        {error && <div className="card p-4 text-center text-sm">読み込みに失敗しました</div>}
        {!error && !stories &&
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}
        {stories && stories.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-sm">まだ読みかけの物語がありません</p>
            <Link href="/" className="btn-primary mt-3 block">
              物語を探す
            </Link>
          </div>
        )}
        {stories?.map((st) => {
          const episodes = Math.max(1, Math.floor((st.messages[0]?.idx ?? 0) / 2));
          const recap = st.lastRecap ?? st.messages[0]?.content.slice(0, 60) ?? "";
          return (
            <div key={st.id} data-testid="story-card" className="card relative flex gap-3 p-3">
              <Link href={`/story/${st.id}`} className="w-16 shrink-0">
                <Cover
                  s={{
                    id: st.situation.id,
                    title: st.situation.title,
                    catchphrase: "",
                    coverImageUrl: st.situation.coverImageUrl,
                    contentLevel: "ALL_AGES",
                    likeCount: 0,
                    readerCount: 0,
                    tags: [],
                  }}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-semibold">{st.situation.title}</p>
                <p data-testid="story-progress" className="text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                  第{episodes}話まで・{relative(st.lastMessageAt)}
                </p>
                <p data-testid="story-recap" className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--c-textMuted)" }}>
                  ▸ 前回まで: {recap || "あらすじ更新中…"}
                </p>
                <div className="mt-1.5 flex justify-end">
                  <Link href={`/story/${st.id}`} className="text-xs font-semibold" style={{ color: "var(--c-primary)" }}>
                    つづきを読む
                  </Link>
                </div>
              </div>
              <button
                aria-label="その他"
                className="absolute right-2 top-2 px-1 text-sm"
                style={{ color: "var(--c-textMuted)" }}
                onClick={() => setMenuFor(menuFor === st.id ? null : st.id)}
              >
                ⋯
              </button>
              {menuFor === st.id && (
                <div className="card absolute right-2 top-8 z-20 w-44 p-1">
                  <button
                    className="block w-full p-2 text-left text-xs"
                    onClick={async () => {
                      await fetch(`/api/stories/${st.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ status: tab === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }),
                      });
                      setMenuFor(null);
                      load(tab);
                    }}
                  >
                    {tab === "ACTIVE" ? "✅ 完結にする" : "↩ 読んでいるに戻す"}
                  </button>
                  <Link href={`/s/${st.situation.id}`} className="block w-full p-2 text-left text-xs">
                    📖 作品ページへ
                  </Link>
                  <button
                    className="block w-full p-2 text-left text-xs"
                    style={{ color: "var(--c-danger)" }}
                    onClick={async () => {
                      if (!confirm("この物語を本棚から削除しますか?(元に戻せません)")) return;
                      await fetch(`/api/stories/${st.id}`, { method: "DELETE" });
                      setMenuFor(null);
                      load(tab);
                    }}
                  >
                    🗑 本棚から削除
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </main>
      <BottomTab />
    </div>
  );
}
