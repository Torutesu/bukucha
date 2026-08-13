"use client";

import Link from "next/link";
import { fmtCount } from "@/lib/format";

export interface CardData {
  id: string;
  title: string;
  catchphrase: string;
  coverImageUrl: string | null;
  contentLevel: "ALL_AGES" | "R15" | "R18";
  likeCount: number;
  readerCount: number;
  storyCount?: number;
  author?: { nickname: string };
  tags: { tag: { id: string; name: string } }[];
}

export function coverGradient(title: string) {
  return GRADIENTS[(title.charCodeAt(0) ?? 0) % GRADIENTS.length];
}

const GRADIENTS = [
  "linear-gradient(135deg, #b4436c, #7c5cbf)",
  "linear-gradient(135deg, #7c5cbf, #4361b4)",
  "linear-gradient(135deg, #b4436c, #d98e5f)",
  "linear-gradient(135deg, #43847c, #7c5cbf)",
];

export function Cover({ s, className }: { s: CardData; className?: string }) {
  const g = GRADIENTS[(s.title.charCodeAt(0) ?? 0) % GRADIENTS.length];
  return s.coverImageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={s.coverImageUrl}
      alt=""
      data-testid="card-cover"
      className={`aspect-[3/4] w-full rounded-[12px] object-cover ${className ?? ""}`}
    />
  ) : (
    <div
      data-testid="card-cover"
      className={`flex aspect-[3/4] w-full items-end rounded-[12px] p-2 ${className ?? ""}`}
      style={{ background: g }}
    >
      <span
        className="line-clamp-4 font-serif text-[11px] leading-snug text-white/95"
        style={{ textShadow: "0 1px 4px rgb(0 0 0 / 0.35)" }}
      >
        {s.title}
      </span>
    </div>
  );
}

export function SituationCard({ s, testid = "situation-card" }: { s: CardData; testid?: string }) {
  return (
    <Link
      href={`/s/${s.id}`}
      data-testid={testid}
      className="pressable block w-36 shrink-0 snap-start"
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
          <span data-testid="card-readers">📖 {fmtCount(s.readerCount)}</span>
          <span data-testid="card-likes">♥ {fmtCount(s.likeCount)}</span>
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

/** ホームの2カラム大判カード(Zeta型: 大表紙+💬会話数バッジ+タイトル+一言+タグ+作者) */
export function PlotGridCard({ s, rank }: { s: CardData; rank?: number }) {
  return (
    <Link href={`/s/${s.id}`} data-testid="situation-card" className="pressable block">
      <div className="relative">
        <Cover s={s} />
        {rank !== undefined && (
          <span
            data-testid="card-rank"
            className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-br-xl rounded-tl-[12px] text-sm font-bold text-white"
            style={{ background: "color-mix(in oklab, var(--c-primary) 85%, black)" }}
          >
            {rank}
          </span>
        )}
        <span
          data-testid="card-stories"
          className="absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
          style={{ background: "rgb(0 0 0 / 0.45)", backdropFilter: "blur(3px)" }}
        >
          💬 {fmtCount(s.storyCount ?? 0)}
        </span>
      </div>
      <div className="mt-1.5 space-y-0.5">
        <p data-testid="card-title" className="line-clamp-1 text-[0.95rem] font-bold leading-snug">
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
        <p data-testid="card-catch" className="line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--c-textMuted)" }}>
          {s.catchphrase}
        </p>
        <p className="line-clamp-1">
          {s.tags.map((t) => (
            <span key={t.tag.id} className="mr-1.5 text-[11px]" style={{ color: "var(--c-accent)" }}>
              #{t.tag.name}
            </span>
          ))}
        </p>
        {s.author && (
          <p data-testid="card-author" className="line-clamp-1 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
            @{s.author.nickname}
          </p>
        )}
      </div>
    </Link>
  );
}
