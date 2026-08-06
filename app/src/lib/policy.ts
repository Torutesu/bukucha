import type { ContentLevel, User } from "@prisma/client";

/**
 * コンテンツポリシー(02-schema.md 不変条件 / 05-ai-features AIF-006,007)。
 * 判定・強制はすべてサーバー側。ここが唯一の判断箇所。
 */

/** 18歳以上か */
export function isAdult(user: Pick<User, "birthDate"> | null): boolean {
  if (!user?.birthDate) return false;
  const now = new Date();
  const b = user.birthDate;
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 18;
}

/** このユーザーに見せてよいcontentLevel一覧(不変条件#2) */
export function visibleLevels(
  user: Pick<User, "birthDate" | "safeFilterOff"> | null
): ContentLevel[] {
  if (user && user.safeFilterOff && isAdult(user)) return ["ALL_AGES", "R15"];
  return ["ALL_AGES"];
}

/** 生成プロンプトに与える表現水準プロファイル(AIF-007) */
export function expressionProfile(
  situationLevel: ContentLevel,
  user: Pick<User, "birthDate" | "safeFilterOff"> | null
): "ALL_AGES" | "R15" {
  return situationLevel === "R15" && visibleLevels(user).includes("R15")
    ? "R15"
    : "ALL_AGES";
}

// ============ AIF-006: ルールベース前段 ============

/**
 * 既知IP辞書(二次創作禁止 [USER-REQ])。
 * 実運用では外部辞書+定期更新。MVPは代表的な検出例+E2E対象を同梱。
 */
export const IP_DICTIONARY: string[] = [
  "五条悟",
  "呪術廻戦",
  "鬼滅の刃",
  "竈門炭治郎",
  "ヒロアカ",
  "僕のヒーローアカデミア",
  "ワンピース",
  "モンキー・D・ルフィ",
  "NARUTO",
  "うちはサスケ",
  "ハリー・ポッター",
  "ツイステッドワンダーランド",
  "刀剣乱舞",
  "文豪ストレイドッグス",
  "ハイキュー",
  "東京リベンジャーズ",
  "佐野万次郎",
  "ちいかわ",
  "初音ミク",
];

/** 規約禁止表現(R15でも不可: nsfw-analysis.md / SCR-020ガイドライン) */
export const BANNED_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /(小|中)学生.{0,12}(性|裸|セックス)/, label: "未成年への性的表現" },
  { pattern: /レイプ|強姦/, label: "非同意の性表現" },
  { pattern: /近親相姦/, label: "近親性交の表現" },
];

export interface RuleCheckResult {
  ipDetected: string[];
  banned: string[];
}

export function ruleCheck(text: string): RuleCheckResult {
  const ipDetected = IP_DICTIONARY.filter((name) => text.includes(name));
  const banned = BANNED_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    (b) => b.label
  );
  return { ipDetected, banned };
}
