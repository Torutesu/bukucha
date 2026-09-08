import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { GuideCta, GuideLayout } from "@/components/GuideLayout";
import { GUIDES } from "@/lib/guides";
import { absoluteUrl, pageMetadata, serializeJsonLd } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "AIノベルチャットの楽しみ方・作品づくりガイド",
  description: "Bukuchaの始め方、オリジナル恋愛シチュエーションの作り方、AIチャットでの返事のコツを、具体的な設定例と入力例で紹介します。",
  path: "/guides",
});

export default function GuidesPage() {
  return (
    <GuideLayout breadcrumbs={[{ label: "楽しみ方ガイド" }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "ホーム", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "楽しみ方ガイド", item: absoluteUrl("/guides") },
        ],
      }) }} />
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide" style={{ color: "var(--c-primary)" }}>
        <BookOpen size={15} aria-hidden /> BUKUCHA GUIDE
      </p>
      <h1 className="text-[1.75rem] font-bold leading-snug">物語に入る。<br />自分の言葉で、つづける。</h1>
      <p className="mt-4 text-sm leading-7" style={{ color: "var(--c-textMuted)" }}>
        AIノベルチャットの始め方から、相手への返事、オリジナル作品づくりまで。試しながら使える例を集めました。
      </p>
      <div className="mt-8 space-y-4">
        {GUIDES.map((guide, index) => (
          <article key={guide.slug} className="card card-flat p-5">
            <p className="text-xs font-semibold" style={{ color: "var(--c-primary)" }}>0{index + 1} / {guide.category}</p>
            <h2 className="mt-3 text-lg font-bold leading-relaxed">
              <Link href={`/guides/${guide.slug}`} className="underline-offset-4 hover:underline">{guide.title}</Link>
            </h2>
            <p className="mt-3 text-sm leading-7" style={{ color: "var(--c-textMuted)" }}>{guide.description}</p>
            <Link href={`/guides/${guide.slug}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--c-primary)" }} aria-label={`${guide.title}を読む`}>
              ガイドを読む <ArrowRight size={15} aria-hidden />
            </Link>
          </article>
        ))}
      </div>
      <p className="mt-6 text-xs leading-6" style={{ color: "var(--c-textMuted)" }}>
        ガイドはBukuchaの機能と投稿方針に基づいて作成しています。はじめての方は、<Link href="/about" className="underline underline-offset-2">Bukuchaについて</Link>もご覧ください。
      </p>
      <GuideCta href="/" label="物語を探す" description="気になるシチュエーションがあれば、まず一言、返してみよう。" />
    </GuideLayout>
  );
}
