import { brand, type Brand } from "../../brand.config";

/** brand.config -> CSS custom properties. Screens read only these. */
function varsOf(colors: Record<string, string>): string {
  return Object.entries(colors)
    .map(([k, v]) => `--c-${k}: ${v};`)
    .join("\n");
}

export function buildThemeCss(b: Brand = brand): string {
  return `
:root {
${varsOf(b.colors.light)}
--font-ui: ${b.fonts.ui};
--font-novel: ${b.fonts.novel};
--radius-card: ${b.radius.card};
--radius-chip: ${b.radius.chip};
--radius-input: ${b.radius.input};
--shell-max: ${b.layout.maxWidth};
--reader-wide: ${b.layout.readerWide};
--sidebar-w: ${b.layout.sidebar};
${Object.entries(b.rarity)
  .map(([k, v]) => `--rarity-${k}: ${v.color};`)
  .join("\n")}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${varsOf(b.colors.dark)}
  }
}
:root[data-theme="dark"] {
${varsOf(b.colors.dark)}
}
`;
}

export { brand };
