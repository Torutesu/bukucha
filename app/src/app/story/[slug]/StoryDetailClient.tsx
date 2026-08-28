"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cover } from "@/components/StoryCard";
import { brand } from "@/lib/theme";

export interface Detail {
  id: string;
  slug: string;
  title: string;
  logline: string;
  worldSetting: string;
  coverImageUrl: string | null;
  contentLevel: "ALL_AGES" | "TEEN" | "MATURE";
  likeCount: number;
  playerCount: number;
  routeCount: number;
  likedByMe: boolean;
  endingsFound: string[];
  author: { id: string; handle: string; displayName: string };
  characters: {
    id: string;
    name: string;
    profileImageUrl: string | null;
    personality: string;
    speechStyle: string;
    relationship: string;
  }[];
  intros: {
    id: string;
    label: string;
    introText: string;
    playGuide: string;
    stats: { id: string; name: string; icon: string }[];
    endings: { id: string; rarity: "N" | "R" | "SR" | "SSR"; hint: string }[];
  }[];
  tags: { tag: { id: string; name: string } }[];
}

const REPORT_REASONS = [
  "Uses an existing IP",
  "Sexual content involving minors",
  "Depicts a real person",
  "Something else",
];

export function StoryDetailClient({
  initial,
  totalEndings,
  foundEndings,
}: {
  initial: Detail;
  totalEndings: number;
  foundEndings: number;
}) {
  const detail = initial;
  const router = useRouter();
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [introId, setIntroId] = useState<string>(detail.intros[0]?.id ?? "");
  const [likeCount, setLikeCount] = useState(detail.likeCount);
  const [liked, setLiked] = useState(detail.likedByMe);
  const [inProgress, setInProgress] = useState<{ id: string; count: number } | null>(null);
  const [starting, setStarting] = useState(false);
  const [charModal, setCharModal] = useState<Detail["characters"][0] | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [worldExpanded, setWorldExpanded] = useState(false);
  const [ready, setReady] = useState(false);

  // This page is server-rendered, so its controls exist before React has
  // attached to them. Keep them disabled until they actually work.
  useEffect(() => setReady(true), []);

  const intro = detail.intros.find((i) => i.id === introId) ?? detail.intros[0];

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/me");
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      if (!meData) return;
      const st = await fetch(`/api/routes?storyId=${detail.id}`);
      if (!st.ok) return;
      const j = await st.json();
      if (j.items.length > 0)
        setInProgress({ id: j.items[0].id, count: j.items[0].messages[0]?.idx ?? 0 });
    })();
  }, [detail.id]);

  const start = async () => {
    if (starting) return;
    setStarting(true);
    if (me) {
      const r = await fetch("/api/routes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storyId: detail.id, introId }),
      });
      if (r.ok) {
        const route = await r.json();
        router.push(`/play/${route.id}`);
        return;
      }
      setStarting(false);
      return;
    }
    // Signed out: play a few turns first, sign in after (SCR-001 / FLOW-1).
    localStorage.setItem(
      "hc_guest_route",
      JSON.stringify({
        storyId: detail.id,
        introId,
        title: detail.title,
        introText: intro?.introText ?? "",
        messages: [],
      })
    );
    router.push("/play/guest");
  };

  const toggleLike = async () => {
    if (!me) {
      router.push(`/login?returnTo=${encodeURIComponent(`/story/${detail.slug}`)}`);
      return;
    }
    const r = await fetch(`/api/stories/${detail.id}/like`, { method: liked ? "DELETE" : "POST" });
    if (r.ok) {
      setLikeCount((await r.json()).likeCount);
      setLiked(!liked);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
        style={{ background: "var(--c-bg)" }}
      >
        <button aria-label="Back" className="text-lg" onClick={() => router.back()}>
          ←
        </button>
        <div className="flex items-center gap-3">
          <button
            data-testid="like-button"
            data-count={likeCount}
            data-liked={liked}
            onClick={toggleLike}
            disabled={!ready}
            className="text-sm"
            style={{ color: liked ? "var(--c-primary)" : "var(--c-textMuted)" }}
          >
            ♥ {likeCount.toLocaleString()}
          </button>
          <div className="relative">
            <button aria-label="More" disabled={!ready} onClick={() => setReportOpen((v) => !v)}>
              ⋯
            </button>
            {reportOpen && (
              <div className="card absolute right-0 z-20 w-52 p-2">
                {reported ? (
                  <p className="p-2 text-xs">Thanks — we will take a look.</p>
                ) : (
                  REPORT_REASONS.map((reason) => (
                    <button
                      key={reason}
                      className="block w-full p-2 text-left text-xs hover:opacity-70"
                      onClick={async () => {
                        if (!me) {
                          router.push(
                            `/login?returnTo=${encodeURIComponent(`/story/${detail.slug}`)}`
                          );
                          return;
                        }
                        await fetch("/api/reports", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            targetType: "story",
                            targetId: detail.id,
                            reason,
                          }),
                        });
                        setReported(true);
                      }}
                    >
                      Report: {reason}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-40">
        <div className="mx-auto w-48">
          <Cover s={detail} />
        </div>
        <h1 data-testid="story-title" className="mt-4 text-xl font-bold leading-snug">
          {detail.title}
        </h1>
        <p data-testid="story-logline" className="novel mt-1 text-[0.95rem]">
          {detail.logline}
        </p>
        <p className="mt-1.5 text-xs" style={{ color: "var(--c-textMuted)" }}>
          by {detail.author.displayName} · ◍ {detail.playerCount.toLocaleString()} players ·{" "}
          {detail.routeCount.toLocaleString()} routes played
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {detail.contentLevel === "TEEN" && (
            <span
              data-testid="teen-badge"
              className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
              style={{ background: "var(--c-danger)" }}
            >
              18+
            </span>
          )}
          {detail.tags.map((t) => (
            <Link
              key={t.tag.id}
              href={`/search?tags=${encodeURIComponent(t.tag.name)}`}
              className="chip text-[11px]"
            >
              {t.tag.name}
            </Link>
          ))}
        </div>

        {totalEndings > 0 && (
          <section data-testid="ending-progress" className="card mt-4 p-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold">Endings</h2>
              <span className="text-xs" style={{ color: "var(--c-textMuted)" }}>
                {foundEndings} of {totalEndings} found
              </span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {detail.intros.flatMap((i) =>
                i.endings.map((e, idx) => {
                  const found = detail.endingsFound.includes(e.id);
                  return (
                    <span
                      key={e.id}
                      title={found ? brand.rarity[e.rarity].label : "Not yet found"}
                      aria-label={`${brand.rarity[e.rarity].label} ending ${idx + 1}`}
                      className="h-5 w-5 rounded-full"
                      style={{
                        background: found ? brand.rarity[e.rarity].color : "transparent",
                        border: `2px solid ${brand.rarity[e.rarity].color}`,
                        opacity: found ? 1 : 0.35,
                      }}
                    />
                  );
                })
              )}
            </div>
            <p className="mt-2 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
              Every route ends somewhere. Rarer endings need different choices, not more turns.
            </p>
          </section>
        )}

        <section className="mt-5">
          <h2 className="text-sm font-bold">The world</h2>
          <p
            className={`novel mt-2 whitespace-pre-wrap text-[0.95rem] ${
              worldExpanded ? "" : "line-clamp-[8]"
            }`}
          >
            {detail.worldSetting}
          </p>
          {detail.worldSetting.length > 200 && !worldExpanded && (
            <button
              className="mt-1 text-xs"
              style={{ color: "var(--c-accent)" }}
              onClick={() => setWorldExpanded(true)}
            >
              Read more
            </button>
          )}
        </section>

        <section className="mt-5">
          <h2 className="text-sm font-bold">Who you will meet</h2>
          <div className="mt-2 flex gap-3 overflow-x-auto">
            {detail.characters.map((c) => (
              <button key={c.id} className="card w-28 shrink-0 p-2 text-left" onClick={() => setCharModal(c)}>
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[10px]" style={{ color: "var(--c-textMuted)" }}>
                  {c.relationship}
                </p>
              </button>
            ))}
          </div>
        </section>

        {!!intro?.stats.length && (
          <section className="mt-5">
            <h2 className="text-sm font-bold">What this route tracks</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {intro.stats.map((st) => (
                <span key={st.id} className="chip text-[11px]">
                  {st.icon} {st.name}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="mt-5">
          <h2 className="text-sm font-bold">How it opens</h2>
          <div
            data-testid="intro-preview"
            className="relative mt-2 overflow-hidden rounded-xl p-4"
            style={{ background: "var(--c-novelBg)", border: "1px solid var(--c-border)" }}
          >
            <p className="novel whitespace-pre-wrap">{(intro?.introText ?? "").slice(0, 400)}…</p>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
              style={{ background: "linear-gradient(transparent, var(--c-novelBg))" }}
            />
          </div>
        </section>
      </main>

      <footer
        className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[var(--shell-max)] space-y-2 border-t px-4 py-3"
        style={{ background: "var(--c-surface)", borderColor: "var(--c-border)" }}
      >
        {inProgress && (
          <Link
            href={`/play/${inProgress.id}`}
            className="block text-center text-xs"
            style={{ color: "var(--c-accent)" }}
          >
            Continue where you left off (scene {Math.max(1, Math.floor(inProgress.count / 2))})
          </Link>
        )}
        {detail.intros.length > 1 && (
          <fieldset className="space-y-1">
            <legend className="label">Where do you want to start?</legend>
            {detail.intros.map((i) => (
              <label key={i.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="intro"
                  aria-label={i.label}
                  checked={introId === i.id}
                  onChange={() => setIntroId(i.id)}
                />
                {i.label}
              </label>
            ))}
          </fieldset>
        )}
        <button className="btn-primary w-full" onClick={start} disabled={starting || !ready}>
          {me ? "Start this story" : "Play a few turns — no account needed"}
        </button>
      </footer>

      {charModal && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/50"
          onClick={() => setCharModal(null)}
        >
          <div
            className="card mx-auto w-full max-w-[var(--shell-max)] rounded-b-none p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold">{charModal.name}</h3>
            <p className="label mt-3">Personality</p>
            <p className="text-sm">{charModal.personality}</p>
            <p className="label mt-3">Voice</p>
            <p className="text-sm">{charModal.speechStyle}</p>
            <p className="label mt-3">Relationship to you</p>
            <p className="text-sm">{charModal.relationship}</p>
            <button className="btn-ghost mt-4 w-full" onClick={() => setCharModal(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
