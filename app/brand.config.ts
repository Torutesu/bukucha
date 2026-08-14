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
      bg: "#faf7f5",
      surface: "#ffffff",
      surfaceAlt: "#f2ece8",
      text: "#241d23",
      textMuted: "#867781",
      primary: "#b03a66",
      primarySoft: "#f9e7ee",
      accent: "#7b57c4",
      border: "#eae0db",
      danger: "#c0392b",
      novelBg: "#fdfaf8",
      novelText: "#2e262c",
      userBubble: "#f4e9ef",
      shadow: "#2b1f27", // 影の色。濃さはcolor-mixで段階を作る
    },
    dark: {
      bg: "#141019",
      surface: "#1e1924",
      surfaceAlt: "#29222f",
      text: "#efe8ed",
      textMuted: "#a1929c",
      primary: "#e2799f",
      primarySoft: "#38232f",
      accent: "#b193e6",
      border: "#342c3d",
      danger: "#e2705f",
      novelBg: "#181320",
      novelText: "#e8dfe6",
      userBubble: "#322740",
      shadow: "#000000",
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
