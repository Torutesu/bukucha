import type { Metadata } from "next";

/** Set SITE_URL to the verified canonical origin when moving to a custom domain. */
function canonicalOrigin() {
  const url = new URL(process.env.SITE_URL ?? "https://bukucha.vercel.app");
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SITE_URL must be an HTTP(S) origin without a path, credentials, query or fragment");
  }
  return url.origin;
}

export const SITE_URL = canonicalOrigin();
export const SITE_NAME = "Bukucha";
export const SITE_DESCRIPTION =
  "Bukuchaは、シチュエーションを選び、AIとあなただけの恋愛小説を進める女性向けノベルAIチャット。オリジナルの世界観や登場人物を作って公開することもできます。";
export const IS_INDEXABLE = process.env.VERCEL_ENV !== "preview" && process.env.SEO_INDEXABLE !== "false";

export function absoluteUrl(path: string) {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function pageMetadata({ title, description, path, index = true }: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Metadata {
  const canIndex = IS_INDEXABLE && index;
  const fullTitle = `${title} | ${SITE_NAME}`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: absoluteUrl(path) },
    robots: { index: canIndex, follow: true, ...(canIndex ? { "max-image-preview": "large" as const } : {}) },
    openGraph: {
      type: "website", locale: "ja_JP", siteName: SITE_NAME,
      title: fullTitle, description, url: absoluteUrl(path),
      images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: "Bukucha — あなたの妄想が、物語になる" }],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [absoluteUrl("/opengraph-image")] },
  };
}

/** User-authored titles must never be able to break out of the script element. */
export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
