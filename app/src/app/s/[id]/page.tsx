import type { Metadata } from "next";
import { absoluteUrl, pageMetadata, serializeJsonLd, SITE_NAME } from "@/lib/seo";
import {
  getAuthorizedSituation,
  getIndexableSituation,
  getSituationPageData,
} from "@/server/public-situation-detail";
import SituationDetailClient from "./SituationDetailClient";

type Props = { params: Promise<{ id: string }> };

function descriptionFor(situation: { catchphrase: string; worldSetting: string }) {
  return (situation.catchphrase || situation.worldSetting).replace(/\s+/g, " ").trim().slice(0, 160)
    || "世界観と登場人物、物語の冒頭を読んで、あなただけの物語をはじめましょう。";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // Check authorization before streaming, including for HTML-only crawlers.
  // A restricted work can have an owner preview without exposing its title.
  await getAuthorizedSituation(id);
  const situation = await getIndexableSituation(id);
  if (!situation) {
    return pageMetadata({
      title: "作品プレビュー",
      description: "この作品は検索エンジン向けには公開されていません。",
      path: `/s/${id}`,
      index: false,
    });
  }
  return pageMetadata({
    title: situation.title,
    description: descriptionFor(situation),
    path: `/s/${situation.id}`,
  });
}

export default async function SituationDetailPage({ params }: Props) {
  const { id } = await params;
  const data = await getSituationPageData(id);
  const situation = await getIndexableSituation(id);
  const url = absoluteUrl(`/s/${id}`);
  const structuredData = situation ? {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CreativeWork",
        "@id": `${url}#work`,
        url,
        name: situation.title,
        description: descriptionFor(situation),
        inLanguage: "ja",
        author: { "@type": "Person", name: situation.author.nickname },
        ...(situation.publishedAt ? { datePublished: situation.publishedAt.toISOString() } : {}),
        ...(situation.tags.length ? { keywords: situation.tags.map(({ tag }) => tag.name).join(", ") } : {}),
        isPartOf: { "@type": "WebSite", "@id": `${absoluteUrl("/")}#website`, name: SITE_NAME },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "ホーム", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: situation.title, item: url },
        ],
      },
    ],
  } : null;

  return (
    <>
      {structuredData && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
      )}
      <SituationDetailClient key={id} {...data} />
    </>
  );
}
