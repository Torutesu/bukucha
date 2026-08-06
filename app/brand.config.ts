/**
 * Design tokens — 全画面の色・フォント・形はここからのみ参照する(ハードコード禁止)。
 * 別ブランド(派生プロダクト)はこのファイルの差し替えで全画面に反映される。
 */
export const brand = {
  name: "Bukucha",
  tagline: "あなたの妄想が、物語になる",
  colors: {
    // 女性向けトンマナ: 深いプラム×生成りの紙、アクセントはローズ
    light: {
      bg: "#faf7f4",
      surface: "#ffffff",
      surfaceAlt: "#f3ede9",
      text: "#2b2126",
      textMuted: "#8a7a82",
      primary: "#b4436c",
      primarySoft: "#f6e3ea",
      accent: "#7c5cbf",
      border: "#e7ddd8",
      danger: "#c0392b",
      novelBg: "#fbf9f6",
      novelText: "#332a2f",
      userBubble: "#f0e6ec",
    },
    dark: {
      bg: "#17121a",
      surface: "#211a25",
      surfaceAlt: "#2a2130",
      text: "#efe7ec",
      textMuted: "#9c8e97",
      primary: "#d76d95",
      primarySoft: "#3a2531",
      accent: "#a58ae0",
      border: "#382e3f",
      danger: "#e07060",
      novelBg: "#1b151f",
      novelText: "#e9e0e6",
      userBubble: "#312639",
    },
  },
  fonts: {
    ui: `"Hiragino Sans", "Noto Sans JP", system-ui, sans-serif`,
    novel: `"Hiragino Mincho ProN", "Noto Serif JP", "Yu Mincho", serif`,
  },
  radius: { card: "16px", chip: "999px", input: "12px" },
  layout: { maxWidth: "480px" }, // PC中央SPビュー [USER-REQ]
} as const;

export type Brand = typeof brand;
