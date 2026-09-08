import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { absoluteUrl, IS_INDEXABLE } from "@/lib/seo";
import { GUIDES } from "@/lib/guides";

// Read current publication state: revoked or age-restricted works must leave the sitemap immediately.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!IS_INDEXABLE) return [];
  const situations = await db.situation.findMany({
    where: { status: "PUBLISHED", contentLevel: "ALL_AGES", title: { not: "" } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return [
    ...["/", "/about", "/guides", "/legal/guideline"].map((path) => ({ url: absoluteUrl(path) })),
    ...GUIDES.map((guide) => ({ url: absoluteUrl(`/guides/${guide.slug}`), lastModified: guide.updatedAt })),
    // updatedAt also changes for likes/counters; do not present it as a content revision.
    ...situations.map((situation) => ({ url: absoluteUrl(`/s/${situation.id}`) })),
  ];
}
