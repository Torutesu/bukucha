"use client";

import Link from "next/link";

export interface CardData {
  id: string;
  title: string;
  catchphrase: string;
  coverImageUrl: string | null;
  contentLevel: "ALL_AGES" | "R15" | "R18";
  likeCount: number;
  readerCount: number;
  tags: { tag: { id: string; name: string } }[];
}

const FALLBACK_COVERS = [
  { src: "/covers/rainy-school.png", match: ["学園", "先輩", "幼なじみ", "同僚"] },
  { src: "/covers/moonlit-duke.png", match: ["王子", "公爵", "悪役令嬢", "西洋風", "異世界"] },
  { src: "/covers/office-night.png", match: ["上司", "オフィス", "現代", "契約"] },
  { src: "/covers/snow-court.png", match: ["和風", "後宮", "敵", "師弟", "ミステリー"] },
] as const;

function getFallbackCover(s: CardData) {
  const tagNames = s.tags.map(({ tag }) => tag.name);
  const matched = FALLBACK_COVERS.find((cover) => cover.match.some((tag) => tagNames.includes(tag)));
  return matched?.src ?? FALLBACK_COVERS[s.title.charCodeAt(0) % FALLBACK_COVERS.length].src;
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

export function SituationCard({ s, testid = "situation-card" }: { s: CardData; testid?: string }) {
  return (
    <Link
      href={`/s/${s.id}`}
      data-testid={testid}
      className="block w-36 shrink-0 snap-start"
    >
      <Cover s={s} />
      <div className="mt-1.5 space-y-0.5">
        <p data-testid="card-title" className="line-clamp-2 text-[13px] font-semibold leading-tight">
          {s.contentLevel === "R15" && (
            <span
              data-testid="r15-badge"
              className="mr-1 rounded px-1 text-[10px] font-bold text-white"
              style={{ background: "var(--c-danger)" }}
            >
              R15
            </span>
          )}
          {s.title}
        </p>
        <p data-testid="card-catch" className="line-clamp-1 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
          {s.catchphrase}
        </p>
        <p className="flex gap-2 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
          <span data-testid="card-readers">📖 {s.readerCount.toLocaleString()}</span>
          <span data-testid="card-likes">♥ {s.likeCount.toLocaleString()}</span>
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
