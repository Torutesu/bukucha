import { brand } from "@/lib/theme";

/**
 * Bukuchaのロゴ。開いた本のページが吹き出しになる = 「読む」と「話す」が重なるプロダクトの象徴。
 * 色はブランドトークン(--c-primary / --c-accent)から取るため、テーマ切替に追従する。
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const gid = "bukucha-logo-grad";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label={`${brand.name}のロゴ`}
      className={className}
    >
      <defs>
        <linearGradient id={gid} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--c-primary)" />
          <stop offset="1" stopColor="var(--c-accent)" />
        </linearGradient>
      </defs>
      {/* 吹き出し(本のページ) */}
      <path
        d="M8 12a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v16a6 6 0 0 1-6 6H22l-8.5 7.2A1 1 0 0 1 12 40.4V34a6 6 0 0 1-4-5.7V12Z"
        fill={`url(#${gid})`}
      />
      {/* 中央の綴じ目 */}
      <path d="M24 13.5v15" stroke="var(--c-surface)" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      {/* 本文の行 */}
      <path
        d="M14.5 17.5h6M14.5 22.5h6M27.5 17.5h6M27.5 22.5h6"
        stroke="var(--c-surface)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}

/** ワードマーク(文字のみ)。マークを大きく見せたい画面で併用する */
export function Wordmark({ size = "1.15rem" }: { size?: string }) {
  return (
    <span
      style={{
        fontSize: size,
        fontWeight: 800,
        letterSpacing: "0.01em",
        background: "linear-gradient(100deg, var(--c-primary), var(--c-accent))",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
    >
      {brand.name}
    </span>
  );
}

/** マーク+ワードマーク。ヘッダーやログイン画面で使う */
export function Logo({
  size = 28,
  wordSize = "1.15rem",
  className,
}: {
  size?: number;
  wordSize?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark size={size} />
      <Wordmark size={wordSize} />
    </span>
  );
}
