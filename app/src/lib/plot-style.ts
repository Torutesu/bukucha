/**
 * プロットのスタイル設定(Zeta型「スタイル」タブ)と設定集(キーワード連動)。
 * 保存はSituation.style(JSON)/Situation.lore(JSON)。プロンプト構築時に文章化して注入する。
 */

export interface PlotStyle {
  choices: boolean; // ユーザーターンに選択肢を提供
  infoboxBg: boolean; // 背景のインフォボックス
  infoboxChar: boolean; // キャラのインフォボックス
  difficulty: "easy" | "normal" | "hard" | "extreme";
  pace: "fast" | "natural" | "slow";
  pov: "first" | "second" | "third";
  tense: "past" | "present";
  length: "short" | "medium" | "long" | "auto";
  expression: "dialogue" | "balanced" | "action";
  moods: string[]; // 最大2
  writingStyle: string; // "" = 設定しない
}

export const DEFAULT_STYLE: PlotStyle = {
  choices: true,
  infoboxBg: false,
  infoboxChar: false,
  difficulty: "normal",
  pace: "natural",
  pov: "second",
  tense: "present",
  length: "auto",
  expression: "balanced",
  moods: [],
  writingStyle: "",
};

export const MOODS = [
  "ロマンス",
  "癒し",
  "シリアス",
  "ヤンデレ",
  "ファンタジー",
  "アクション",
  "ミステリー",
  "ホラー",
] as const;

export const WRITING_STYLES = [
  "恋愛心理小説",
  "ハードボイルド",
  "夜想文学",
  "温かな青春物語",
  "アクション",
  "王道ファンタジー",
  "ライトノベル",
  "心理ホラー",
] as const;

export interface LoreEntry {
  id: string;
  keyword: string;
  content: string;
}

export function parseStyle(raw: unknown): PlotStyle {
  const s = (raw ?? {}) as Partial<PlotStyle>;
  return {
    ...DEFAULT_STYLE,
    ...s,
    moods: Array.isArray(s.moods) ? s.moods.filter((m) => typeof m === "string").slice(0, 2) : [],
  };
}

export function parseLore(raw: unknown): LoreEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is LoreEntry => !!e && typeof e === "object" && typeof (e as LoreEntry).keyword === "string")
    .slice(0, 5)
    .map((e) => ({
      id: String(e.id ?? e.keyword),
      keyword: String(e.keyword).slice(0, 30),
      content: String(e.content ?? "").slice(0, 1000),
    }));
}

const POV_TEXT: Record<PlotStyle["pov"], string> = {
  first: "一人称視点(主人公「わたし」の内側から)で描写する",
  second: "二人称視点(あなた=主人公)で描写する",
  third: "三人称視点(客観的な語り)で描写する",
};
const TENSE_TEXT: Record<PlotStyle["tense"], string> = {
  past: "地の文は過去形(〜した)で書く",
  present: "地の文は現在形(〜する)で書く",
};
const LENGTH_TEXT: Record<PlotStyle["length"], string> = {
  short: "1応答は150〜250字と短めにする",
  medium: "1応答は300〜450字にする",
  long: "1応答は500〜800字とたっぷり書く",
  auto: "1応答は300〜600字。場面の緩急に合わせて自然に調整する",
};
const EXPRESSION_TEXT: Record<PlotStyle["expression"], string> = {
  dialogue: "セリフ多めで、会話のテンポを重視する",
  balanced: "セリフと行動・情景描写のバランスを保つ",
  action: "行動と情景描写を多めにし、セリフは要所に絞る",
};
const DIFFICULTY_TEXT: Record<PlotStyle["difficulty"], string> = {
  easy: "キャラクターは主人公に好意的で、関係は進展しやすい",
  normal: "キャラクターはそれぞれの性格と状況に合わせて自然に行動する",
  hard: "キャラクターは簡単には心を開かない。信頼を得るには相応の言動が要る",
  extreme: "キャラクターは極めて頑なで、安易な言動には冷たく反応する。関係の進展は稀で重い",
};
const PACE_TEXT: Record<PlotStyle["pace"], string> = {
  fast: "展開は速く、1応答ごとに状況を大きく動かす",
  natural: "展開の緩急は物語に合わせて自然に調整する",
  slow: "展開はゆっくりで、心情と間の描写を厚くする",
};

/** スタイル設定を system プロンプト用の日本語ルールに変換する */
export function styleRules(style: PlotStyle): string {
  const lines = [
    `- ${POV_TEXT[style.pov]}`,
    `- ${TENSE_TEXT[style.tense]}`,
    `- ${LENGTH_TEXT[style.length]}`,
    `- ${EXPRESSION_TEXT[style.expression]}`,
    `- ${DIFFICULTY_TEXT[style.difficulty]}`,
    `- ${PACE_TEXT[style.pace]}`,
  ];
  if (style.moods.length) lines.push(`- 物語の雰囲気: ${style.moods.join("、")}`);
  if (style.writingStyle) lines.push(`- 文章スタイル: ${style.writingStyle}の筆致で書く`);
  if (style.infoboxBg)
    lines.push("- 応答の冒頭に【場所/時刻/状況】を1行のインフォボックスとして添える");
  if (style.infoboxChar)
    lines.push("- 応答の冒頭に【相手の心情/態度】を1行のインフォボックスとして添える");
  return lines.join("\n");
}

/** 直近の文脈に登場したキーワードの設定集だけを抜き出す(全部入れない) */
export function activeLore(lore: LoreEntry[], context: string): LoreEntry[] {
  return lore.filter((e) => e.keyword && context.includes(e.keyword));
}
