"use client";

import Link from "next/link";
import { brand } from "@/lib/theme";

export interface CardData {
  id: string;
  slug?: string;
  title: string;
  logline: string;
  coverImageUrl: string | null;
  contentLevel: "ALL_AGES" | "TEEN" | "MATURE";
  likeCount: number;
  playerCount: number;
  endingCount?: number;
  tags: { tag: { id: string; name: string } }[];
}

/** Until a story has cover art, pick the plate that fits its tags. */
const FALLBACK_COVERS = [
  { src: "/covers/rainy-school.png", match: ["academy", "childhood friends", "slow burn", "grumpy sunshine"] },
  { src: "/covers/moonlit-duke.png", match: ["royalty commoner", "isekai", "fantasy romance", "historical"] },
  { src: "/covers/office-night.png", match: ["boss", "contemporary", "cyberpunk", "roommates"] },
  { src: "/covers/snow-court.png", match: ["court intrigue", "captor captive", "mystery", "mentor"] },
] as const;

function getFallbackCover(s: CardData) {
  const tagNames = s.tags.map(({ tag }) => tag.name);
  const matched = FALLBACK_COVERS.find((c) => c.match.some((t) => tagNames.includes(t)));
  return matched?.src ?? FALLBACK_COVERS[s.title.charCodeAt(0) % FALLBACK_COVERS.length].src;
}

export function storyHref(s: CardData) {
  return `/story/${s.slug ?? s.id}`;
}

export function Cover({ s, className }: { s: CardData; className?: string }) {
  const src = s.coverImageUrl || getFallbackCover(s);
  return s.coverImageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={s.coverImageUrl}
      alt=""
      data-testid="card-cover"
      className={`aspect-[3/4] w-full rounded-[12px] object-cover ${className ?? ""}`}
    />
  ) : (
    <div className={`cover-frame ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" data-testid="card-cover" className="cover-image" />
      <div className="cover-shade" />
      <span className="cover-title line-clamp-4">{s.title}</span>
    </div>
  );
}

export function StoryCard({ s, testid = "story-card" }: { s: CardData; testid?: string }) {
  return (
    <Link href={storyHref(s)} data-testid={testid} className="block w-36 shrink-0 snap-start">
      <Cover s={s} />
      <div className="mt-1.5 space-y-0.5">
        <p data-testid="card-title" className="line-clamp-2 text-[13px] font-semibold leading-tight">
          {s.contentLevel === "TEEN" && (
            <span
              data-testid="teen-badge"
              className="mr-1 rounded px-1 text-[10px] font-bold text-white"
              style={{ background: "var(--c-danger)" }}
            >
              18+
            </span>
          )}
          {s.title}
        </p>
        <p
          data-testid="card-logline"
          className="line-clamp-2 text-[11px]"
          style={{ color: "var(--c-textMuted)" }}
        >
          {s.logline}
        </p>
        <p className="flex gap-2 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
          <span data-testid="card-players">◍ {s.playerCount.toLocaleString()}</span>
          <span data-testid="card-likes">♥ {s.likeCount.toLocaleString()}</span>
          {!!s.endingCount && (
            <span data-testid="card-endings" style={{ color: brand.rarity.SSR.color }}>
              ★ {s.endingCount.toLocaleString()}
            </span>
          )}
        </p>
        <p className="flex flex-wrap gap-1">
          {s.tags.slice(0, 2).map((t) => (
            <span key={t.tag.id} className="text-[10px]" style={{ color: "var(--c-accent)" }}>
              #{t.tag.name}
            </span>
          ))}
        </p>
      </div>
    </Link>
  );
}
