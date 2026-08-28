"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomTab } from "@/components/BottomTab";
import { Cover } from "@/components/StoryCard";

interface ShelfRoute {
  id: string;
  status: "ACTIVE" | "ENDED" | "ARCHIVED";
  lastRecap: string | null;
  lastRecapAtIdx: number;
  lastMessageAt: string;
  story: { id: string; slug: string; title: string; coverImageUrl: string | null };
  messages: { idx: number; content: string }[];
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${Math.max(1, min)}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  return `${d}d ago`;
}

// SCR-007: Library
export default function LibraryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"ACTIVE" | "ENDED">("ACTIVE");
  const [shelf, setShelf] = useState<{ tab: string; items: ShelfRoute[] } | null>(null);
  const [error, setError] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const setStories = (
    updater: ShelfRoute[] | null | ((prev: ShelfRoute[] | null) => ShelfRoute[] | null)
  ) => {
    setShelf((prev) => {
      const current = prev?.items ?? null;
      const next = typeof updater === "function" ? updater(current) : updater;
      return next ? { tab, items: next } : null;
    });
  };

  const load = async (status: "ACTIVE" | "ENDED") => {
    const r = await fetch(`/api/routes?status=${status}`);
    if (r.status === 401) {
      router.replace(`/login?returnTo=${encodeURIComponent("/library")}`);
      return;
    }
    if (!r.ok) {
      setError(true);
      return;
    }
    const j = await r.json();
    setShelf({ tab: status, items: j.items });
    // AIF-006: refresh any stale recap in the background.
    for (const st of j.items as ShelfRoute[]) {
      const latest = st.messages[0]?.idx ?? 0;
      if (!st.lastRecap || st.lastRecapAtIdx < latest - 1) {
        fetch(`/api/routes/${st.id}/recap`, { method: "POST" })
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

  const routes = shelf && shelf.tab === tab ? shelf.items : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 pt-4">
        <h1 className="text-xl font-bold">Library</h1>
        <div className="mt-2 flex gap-2">
          <button className="chip" data-on={tab === "ACTIVE"} onClick={() => setTab("ACTIVE")}>
            Playing
          </button>
          <button className="chip" data-on={tab === "ENDED"} onClick={() => setTab("ENDED")}>
            Finished
          </button>
        </div>
      </header>

      <main className="flex-1 space-y-3 px-4 py-4">
        {error && <div className="card p-4 text-center text-sm">We could not load your library.</div>}
        {!error && !routes &&
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-28 animate-pulse" />)}
        {routes && routes.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-sm">
              {tab === "ACTIVE" ? "Nothing in progress yet." : "You have not finished a route yet."}
            </p>
            <Link href="/" className="btn-primary mt-3 block">
              Find a story
            </Link>
          </div>
        )}
        {routes?.map((st) => {
          const episodes = Math.max(1, Math.floor((st.messages[0]?.idx ?? 0) / 2));
          const recap = st.lastRecap ?? st.messages[0]?.content.slice(0, 60) ?? "";
          return (
            <div key={st.id} data-testid="route-card" className="card relative flex gap-3 p-3">
              <Link href={`/play/${st.id}`} className="w-16 shrink-0">
                <Cover
                  s={{
                    id: st.story.id,
                    title: st.story.title,
                    slug: st.story.slug,
                    logline: "",
                    coverImageUrl: st.story.coverImageUrl,
                    contentLevel: "ALL_AGES",
                    likeCount: 0,
                    playerCount: 0,
                    tags: [],
                  }}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-semibold">{st.story.title}</p>
                <p data-testid="route-progress" className="text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                  {episodes} {episodes === 1 ? "scene" : "scenes"} · {relative(st.lastMessageAt)}
                </p>
                <p data-testid="route-recap" className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--c-textMuted)" }}>
                  Previously — {recap || "catching up…"}
                </p>
                <div className="mt-1.5 flex justify-end">
                  <Link href={`/play/${st.id}`} className="text-xs font-semibold" style={{ color: "var(--c-primary)" }}>
                    Continue
                  </Link>
                </div>
              </div>
              <button
                aria-label="More"
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
                      await fetch(`/api/routes/${st.id}`, {
                        method: "PATCH",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ status: tab === "ACTIVE" ? "ENDED" : "ACTIVE" }),
                      });
                      setMenuFor(null);
                      load(tab);
                    }}
                  >
                    {tab === "ACTIVE" ? "Mark as finished" : "Move back to playing"}
                  </button>
                  <Link href={`/story/${st.story.slug}`} className="block w-full p-2 text-left text-xs">
                    Go to story page
                  </Link>
                  <button
                    className="block w-full p-2 text-left text-xs"
                    style={{ color: "var(--c-danger)" }}
                    onClick={async () => {
                      if (!confirm("Delete this route? This cannot be undone.")) return;
                      await fetch(`/api/routes/${st.id}`, { method: "DELETE" });
                      setMenuFor(null);
                      load(tab);
                    }}
                  >
                    Delete route
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
