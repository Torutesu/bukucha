/**
 * Design tokens. Every screen reads colour, type and shape from here and
 * nowhere else — hard-coded values are a bug.
 *
 * Swapping this file re-skins the whole product, which is how a sibling brand
 * (or the archived Japanese build) is produced without touching a screen.
 */
export const brand = {
  name: "HEADCANON",
  tagline: "Your headcanon, playable",
  /** Used in metadata and anywhere the promise needs one line. */
  promise: "Interactive anime that remembers what you told it.",
  colors: {
    // Ink and paper: the reading surface stays warm, the chrome stays cool.
    light: {
      bg: "#f6f4f0",
      surface: "#ffffff",
      surfaceAlt: "#ece8e2",
      text: "#16141b",
      textMuted: "#6b6572",
      primary: "#d8412f",
      primarySoft: "#fbe6e2",
      accent: "#6c4bf5",
      accentSoft: "#ebe6ff",
      border: "#e0dad2",
      danger: "#b4291d",
      novelBg: "#fbf9f6",
      novelText: "#221f28",
      userBubble: "#ece8f6",
    },
    dark: {
      bg: "#0e0d13",
      surface: "#181722",
      surfaceAlt: "#22202e",
      text: "#eceaf3",
      textMuted: "#948fa4",
      primary: "#f2604d",
      primarySoft: "#33191b",
      accent: "#9b83ff",
      accentSoft: "#241f3d",
      border: "#302d40",
      danger: "#f2705c",
      novelBg: "#131220",
      novelText: "#e7e3f0",
      userBubble: "#262238",
    },
  },
  /** Ending rarity, shared by cards, radar and the collection grid. */
  rarity: {
    N: { label: "Common", color: "#8b8794" },
    R: { label: "Rare", color: "#3f8ddc" },
    SR: { label: "Super Rare", color: "#a463f2" },
    SSR: { label: "Legendary", color: "#eda12a" },
  },
  fonts: {
    ui: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`,
    // Prose is read for half an hour at a time. It gets a serif.
    novel: `Literata, "Source Serif 4", Charter, Georgia, "Times New Roman", serif`,
  },
  radius: { card: "14px", chip: "999px", input: "10px" },
  layout: {
    /** Phone-first shell. Desktop keeps this width everywhere except the reader. */
    maxWidth: "520px",
    /** The reader opens into two panes on a wide screen: prose plus state. */
    readerWide: "1080px",
    sidebar: "300px",
  },
} as const;

export type Brand = typeof brand;
