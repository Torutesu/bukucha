import type { MetadataRoute } from "next";
import { absoluteUrl, IS_INDEXABLE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (!IS_INDEXABLE) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    // Let crawlers read noindex on account/search pages. robots.txt is not access control.
    // Search-crawler access is independent of a future decision about model training.
    rules: { userAgent: ["*", "OAI-SearchBot", "PerplexityBot", "Claude-SearchBot"], allow: "/", disallow: "/api/" },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
