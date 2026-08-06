import { brand, type Brand } from "../../brand.config";

/** brand.config → CSS変数。全画面はこの変数経由でのみ色・フォントを参照する */
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
