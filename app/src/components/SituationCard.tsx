"use client";
import { BookOpen, Heart, MessageCircle } from "lucide-react";

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

/** タイトル全体から決まる安定したハッシュ(先頭一文字だけだと色が偏るため) */
function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export function coverGradient(title: string) {
  return GRADIENTS[hash(title) % GRADIENTS.length];
}

const GRADIENTS = [
  "linear-gradient(150deg, #8e2f56, #5b3f96)",
  "linear-gradient(150deg, #4c3b8f, #24406e)",
  "linear-gradient(150deg, #a03c5e, #b9683c)",
  "linear-gradient(150deg, #2f6b63, #4b3f8c)",
  "linear-gradient(150deg, #6b2f52, #2c2a4a)",
  "linear-gradient(150deg, #34506e, #7a4a86)",
  "linear-gradient(150deg, #8a4a2f, #4e2b4a)",
  "linear-gradient(150deg, #47325e, #a34a72)",
];

/**
 * 表紙。画像がない作品は「和書のジャケット」に見えるよう、
 * グラデーション+内枠+縦組みタイトルで組む(のっぺりした色面にしない)。
 */
export function Cover({ s, className }: { s: CardData; className?: string }) {
  const g = coverGradient(s.title);
  const frame =
    "inset 0 0 0 1px rgb(255 255 255 / 0.1), 0 6px 18px -10px color-mix(in oklab, var(--c-shadow) 60%, transparent)";
  return s.coverImageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={s.coverImageUrl}
      alt=""
      data-testid="card-cover"
      className={`aspect-[3/4] w-full rounded-[14px] object-cover ${className ?? ""}`}
      style={{ boxShadow: frame }}
    />
  ) : (
    <div
      data-testid="card-cover"
      className={`relative aspect-[3/4] w-full overflow-hidden rounded-[14px] ${className ?? ""}`}
      style={{ background: g, boxShadow: frame }}
    >
      {/* 上からの光と足元の暗幕で奥行きを作る */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(110% 60% at 22% 0%, rgb(255 255 255 / 0.26), transparent 62%), linear-gradient(to top, rgb(0 0 0 / 0.34), transparent 58%)",
        }}
      />
      {/* ジャケットの内枠 */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[7px] rounded-[8px]"
        style={{ border: "1px solid rgb(255 255 255 / 0.24)" }}
      />
      {/* ジャケットの題字。明朝+細い罫で本の表紙らしく見せる */}
      <span className="absolute inset-x-[15px] bottom-[15px] block">
        <span
          aria-hidden
          className="mb-1.5 block h-px w-7"
          style={{ background: "rgb(255 255 255 / 0.6)" }}
        />
        <span
          className="line-clamp-3 block text-[12.5px] font-medium leading-[1.5] tracking-[0.04em] text-white"
          style={{ fontFamily: "var(--font-novel)", textShadow: "0 1px 8px rgb(0 0 0 / 0.55)" }}
        >
          {s.title}
        </span>
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
          <span data-testid="card-readers" className="inline-flex items-center gap-0.5">
            <BookOpen size={11} /> {fmtCount(s.readerCount)}
          </span>
          <span data-testid="card-likes" className="inline-flex items-center gap-0.5">
            <Heart size={11} /> {fmtCount(s.likeCount)}
          </span>
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
            className="absolute left-0 top-0 flex h-7 w-8 items-center justify-center rounded-br-[14px] rounded-tl-[14px] text-sm font-bold text-white"
            style={{
              background: "linear-gradient(140deg, var(--c-primary), color-mix(in oklab, var(--c-primary) 60%, black))",
            }}
          >
            {rank}
          </span>
        )}
        <span
          data-testid="card-stories"
          className="absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
          style={{ background: "rgb(0 0 0 / 0.38)", backdropFilter: "blur(6px)" }}
        >
          <MessageCircle size={11} className="mr-0.5 inline align-[-1px]" />
          {fmtCount(s.storyCount ?? 0)}
        </span>
      </div>
      <div className="mt-2 space-y-1">
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
        <p data-testid="card-catch" className="line-clamp-2 text-[11.5px] leading-relaxed" style={{ color: "var(--c-textMuted)" }}>
          {s.catchphrase}
        </p>
        <p className="line-clamp-1">
          {s.tags.map((t) => (
            <span key={t.tag.id} className="mr-1.5 text-[10.5px] font-medium" style={{ color: "var(--c-accent)" }}>
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
