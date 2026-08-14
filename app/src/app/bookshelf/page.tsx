"use client";
import { ArrowDownWideNarrow, Bookmark, Ellipsis, Trash2 } from "lucide-react";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomTab } from "@/components/BottomTab";
import { coverGradient } from "@/components/SituationCard";

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

// SCR-007: トーク一覧(Zeta型)
export default function BookshelfPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"ACTIVE" | "ARCHIVED">("ACTIVE");
  const [desc, setDesc] = useState(true);
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

  const stories =
    shelf && shelf.tab === tab
      ? [...shelf.items].sort((a, b) =>
          desc
            ? b.lastMessageAt.localeCompare(a.lastMessageAt)
            : a.lastMessageAt.localeCompare(b.lastMessageAt)
        )
      : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="app-header px-4 pt-4">
        <h1 className="text-xl font-bold">トーク</h1>
        <div className="mt-2 flex items-center gap-2">
          <button className="chip" data-on={tab === "ACTIVE"} onClick={() => setTab("ACTIVE")}>
            <Bookmark size={12} className="mr-1 inline align-[-1px]" />
            保存
          </button>
          <button className="chip" data-on={tab === "ARCHIVED"} onClick={() => setTab("ARCHIVED")}>
            完結した
          </button>
          <button
            className="ml-auto flex items-center gap-1 text-xs"
            style={{ color: "var(--c-textMuted)" }}
            onClick={() => setDesc((d) => !d)}
          >
            <ArrowDownWideNarrow size={14} style={{ transform: desc ? "none" : "scaleY(-1)" }} />
            {desc ? "降順" : "昇順"}
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-1 px-2 py-3">
        {error && <div className="card p-4 text-center text-sm">読み込みに失敗しました</div>}
        {!error && !stories &&
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-[16px]" />)}
        {stories && stories.length === 0 && (
          <div className="card mx-2 p-6 text-center">
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
            <div
              key={st.id}
              data-testid="story-card"
              className="pressable relative flex items-center gap-3 rounded-[16px] px-2 py-2.5"
            >
              <Link href={`/story/${st.id}`} className="shrink-0">
                {st.situation.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={st.situation.coverImageUrl}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
                    style={{ background: coverGradient(st.situation.title) }}
                  >
                    {st.situation.title.charAt(0)}
                  </span>
                )}
              </Link>
              <Link href={`/story/${st.id}`} className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="line-clamp-1 flex-1 text-sm font-semibold">
                    {st.situation.title}
                  </span>
                  <span className="shrink-0 text-[10px]" style={{ color: "var(--c-textMuted)" }}>
                    {relative(st.lastMessageAt)}
                  </span>
                </span>
                <span
                  data-testid="story-recap"
                  className="mt-0.5 line-clamp-1 block text-xs"
                  style={{ color: "var(--c-textMuted)" }}
                >
                  前回まで: {recap || "あらすじ更新中…"}
                </span>
                <span className="mt-0.5 flex items-center justify-between">
                  <span
                    data-testid="story-progress"
                    className="text-[10px]"
                    style={{ color: "var(--c-textMuted)" }}
                  >
                    第{episodes}話まで
                  </span>
                </span>
              </Link>
              <Link
                href={`/story/${st.id}`}
                className="shrink-0 text-xs font-semibold"
                style={{ color: "var(--c-primary)" }}
              >
                つづきを読む
              </Link>
              <button
                aria-label="その他"
                className="shrink-0 px-1"
                style={{ color: "var(--c-textMuted)" }}
                onClick={() => setMenuFor(menuFor === st.id ? null : st.id)}
              >
                <Ellipsis size={18} />
              </button>
              {menuFor === st.id && (
                <div className="card absolute right-2 top-12 z-20 w-44 p-1">
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
                    {tab === "ACTIVE" ? "完結にする" : "読んでいるに戻す"}
                  </button>
                  <Link href={`/s/${st.situation.id}`} className="block w-full p-2 text-left text-xs">
                    作品ページへ
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
                    <Trash2 size={13} className="mr-1 inline align-[-2px]" /> 本棚から削除
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
