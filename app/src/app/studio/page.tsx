"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Work {
  id: string;
  title: string;
  status: string;
  likeCount: number;
  playerCount: number;
  publishedAt: string | null;
}
interface Summary {
  weekReaders: number;
  weekReadersDelta: number;
  weekLikes: number;
  weekLikesDelta: number;
}

// SCR-012: the creator's own view of their work.
//
// The benchmark gates monetisation behind 1,000 readers, 500 followers, ten
// public works and 100,000 interactions before a creator can even apply. Here
// earnings accrue from the first turn of the first story, so this screen shows
// them from day one.
export default function StudioPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"PUBLISHED" | "DRAFT" | "UNLISTED" | "PRIVATE">("PUBLISHED");
  const [worksData, setWorksData] = useState<{ tab: string; items: Work[] } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [openStats, setOpenStats] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, { date: string; routeCount: number }[]>>({});

  useEffect(() => {
    fetch("/api/studio/summary").then(async (r) => {
      if (r.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent("/studio")}`);
        return;
      }
      if (r.ok) setSummary(await r.json());
    });
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/studio/stories?status=${tab}`);
      const j = r.ok ? await r.json() : { items: [] };
      if (!cancelled) setWorksData({ tab, items: j.items });
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const works = worksData && worksData.tab === tab ? worksData.items : null;

  const loadStats = async (id: string) => {
    if (openStats === id) {
      setOpenStats(null);
      return;
    }
    setOpenStats(id);
    if (!stats[id]) {
      const r = await fetch(`/api/studio/stories/${id}/stats`);
      if (r.ok) {
        const j = await r.json();
        setStats((s) => ({ ...s, [id]: j.daily }));
      }
    }
  };

  const maxCount = (id: string) => Math.max(1, ...(stats[id]?.map((d) => d.routeCount) ?? [1]));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-xl font-bold">Studio</h1>
        <Link href="/create" className="btn-primary px-3 py-1.5 text-sm">
          + New story
        </Link>
      </header>

      <main className="flex-1 space-y-4 px-4 py-4">
        <div data-testid="weekly-summary" className="card p-4">
          {summary ? (
            <div className="flex gap-6 text-sm">
              <div>
                <span style={{ color: "var(--c-textMuted)" }}>Players this week</span>
                <p className="text-lg font-bold">
                  📖 {summary.weekReaders}{" "}
                  <span className="text-xs" style={{ color: "var(--c-primary)" }}>
                    ({summary.weekReadersDelta >= 0 ? "+" : ""}
                    {summary.weekReadersDelta})
                  </span>
                </p>
              </div>
              <div>
                <span style={{ color: "var(--c-textMuted)" }}>Likes this week</span>
                <p className="text-lg font-bold">
                  ♥ {summary.weekLikes}{" "}
                  <span className="text-xs" style={{ color: "var(--c-primary)" }}>
                    ({summary.weekLikesDelta >= 0 ? "+" : ""}
                    {summary.weekLikesDelta})
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <div className="h-10 animate-pulse" />
          )}
        </div>

        <div className="flex gap-2">
          {(["PUBLISHED", "DRAFT", "UNLISTED", "PRIVATE"] as const).map((s) => (
            <button key={s} className="chip" data-on={tab === s} onClick={() => setTab(s)}>
              {s === "PUBLISHED"
                ? "Published"
                : s === "DRAFT"
                  ? "Draft"
                  : s === "UNLISTED"
                    ? "Link only"
                    : "Private"}
            </button>
          ))}
        </div>

        {!works && <div className="card h-24 animate-pulse" />}
        {works && works.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-sm">You have not written anything yet.</p>
            <p className="mt-1 text-xs" style={{ color: "var(--c-textMuted)" }}>
              Give us one line and we will build the whole thing — world, cast, stats and endings.
            </p>
            <Link href="/create" className="btn-primary mt-3 block">
              Start writing
            </Link>
          </div>
        )}
        {works?.map((w) => (
          <div key={w.id} data-testid="work-card" className="card p-3">
            <Link href={w.status === "PUBLISHED" ? `/story/${w.id}` : "#"} className="block">
              <p className="text-sm font-semibold">{w.title || "(untitled)"}</p>
            </Link>
            <p className="mt-1 flex gap-3 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
              <span data-testid="stat-readers">📖 {w.playerCount.toLocaleString()}</span>
              <span data-testid="stat-likes">♥ {w.likeCount.toLocaleString()}</span>
              {w.publishedAt && <span>📅 {new Date(w.publishedAt).toLocaleDateString("ja-JP")}</span>}
            </p>
            <div className="mt-2 flex gap-2">
              <Link href={`/create?storyId=${w.id}`} className="btn-ghost px-3 py-1.5 text-xs">
                Edit
              </Link>
              <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => loadStats(w.id)}>
                Stats {openStats === w.id ? "▲" : "▾"}
              </button>
            </div>
            {openStats === w.id && (
              <div data-testid="mini-chart" className="mt-3 flex h-16 items-end gap-0.5">
                {(stats[w.id] ?? []).map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 rounded-t"
                    title={`${d.date}: ${d.routeCount}`}
                    style={{
                      height: `${(d.routeCount / maxCount(w.id)) * 100}%`,
                      minHeight: "2px",
                      background: "var(--c-primary)",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
