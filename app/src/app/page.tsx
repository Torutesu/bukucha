import Link from "next/link";
import HomeClient, { type HomeSection } from "@/components/HomeClient";
import { db } from "@/lib/db";
import { homeSections } from "@/server/situations";
import { absoluteUrl, pageMetadata, serializeJsonLd, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "女性向けノベルAIチャット・オリジナル恋愛小説",
  description: SITE_DESCRIPTION,
  path: "/",
});

export default async function HomePage() {
  const [sections, tags] = await Promise.all([
    homeSections(null),
    db.tag.findMany({ where: { category: "desire", isR15: false }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  // Pass public card fields only. No account preferences, age, or session data enter this HTML.
  const initialSections: HomeSection[] = sections.map((section) => ({
    key: section.key,
    title: section.title,
    situations: section.situations.map((card) => ({
      id: card.id, title: card.title, catchphrase: card.catchphrase, coverImageUrl: card.coverImageUrl,
      contentLevel: card.contentLevel, likeCount: card.likeCount, readerCount: card.readerCount,
      storyCount: card.storyCount, tags: card.tags, author: card.author,
    })),
  }));
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({
        "@context": "https://schema.org", "@type": "WebSite", "@id": absoluteUrl("/#website"),
        name: SITE_NAME, url: absoluteUrl("/"), description: SITE_DESCRIPTION, inLanguage: "ja",
      }) }} />
      <HomeClient initialSections={initialSections} initialTags={tags}>
        <section className="mt-8 space-y-3 border-t pt-5" style={{ borderColor: "var(--c-border)" }}>
          <h2 className="text-base font-bold">読む・作るヒント</h2>
          <p className="text-sm leading-relaxed">物語の選び方から、オリジナルの世界観や登場人物の作り方まで。</p>
          <nav aria-label="読み方と創作ガイド" className="grid gap-3 text-sm" style={{ color: "var(--c-primary)" }}>
            <Link href="/guides/ai-novel-chat">AIノベルチャットとは？ はじめ方ガイド</Link>
            <Link href="/guides/create-original-story">オリジナル恋愛シチュエーションの作り方</Link>
            <Link href="/guides/ai-roleplay-tips">AIとの物語を続ける言葉のヒント</Link>
          </nav>
          <nav aria-label="サービス情報" className="flex flex-wrap gap-4 pt-3 text-xs" style={{ color: "var(--c-textMuted)" }}>
            <Link href="/about">Bukuchaについて</Link>
            <Link href="/guides">ガイド一覧</Link>
            <Link href="/legal/guideline">投稿ガイドライン</Link>
            <Link href="/legal/terms">利用規約</Link>
            <Link href="/legal/privacy">プライバシー</Link>
          </nav>
        </section>
      </HomeClient>
    </>
  );
}
