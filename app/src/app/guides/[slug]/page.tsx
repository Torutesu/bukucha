import Link from "next/link";
import { notFound } from "next/navigation";
import { GuideCta, GuideLayout } from "@/components/GuideLayout";
import { getGuide, GUIDES } from "@/lib/guides";
import { absoluteUrl, pageMetadata, serializeJsonLd } from "@/lib/seo";

export function generateStaticParams() {
  return GUIDES.map(({ slug }) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  return pageMetadata({ title: guide.title, description: guide.description, path: `/guides/${guide.slug}` });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  const url = absoluteUrl(`/guides/${guide.slug}`);
  const [year, month, day] = guide.updatedAt.split("-").map(Number);
  const related = GUIDES.filter((item) => item.slug !== guide.slug);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: guide.title,
        description: guide.description,
        abstract: guide.summary,
        inLanguage: "ja",
        dateModified: guide.updatedAt,
        mainEntityOfPage: url,
        articleSection: guide.category,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "ホーム", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "楽しみ方ガイド", item: absoluteUrl("/guides") },
          { "@type": "ListItem", position: 3, name: guide.title, item: url },
        ],
      },
    ],
  };

  return (
    <GuideLayout breadcrumbs={[{ label: "楽しみ方ガイド", href: "/guides" }, { label: guide.title }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <article>
        <header>
          <p className="mb-3 text-xs font-semibold tracking-wide" style={{ color: "var(--c-primary)" }}>{guide.category}</p>
          <h1 className="text-[1.65rem] font-bold leading-snug">{guide.title}</h1>
          <p className="mt-4 text-xs" style={{ color: "var(--c-textMuted)" }}>更新日：<time dateTime={guide.updatedAt}>{year}年{month}月{day}日</time></p>
          <p className="mt-6 text-[0.95rem] leading-8">{guide.summary}</p>
        </header>

        <aside aria-label="このガイドの要点" className="mt-6 rounded-2xl p-5" style={{ background: "var(--c-primarySoft)" }}>
          <p className="text-sm font-bold">まず押さえたいこと</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7">
            {guide.takeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}
          </ul>
        </aside>

        <nav aria-label="この記事の目次" className="my-8 border-y py-5" style={{ borderColor: "var(--c-border)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--c-textMuted)" }}>この記事でわかること</p>
          <ol className="mt-3 space-y-3 text-sm leading-6">
            {guide.sections.map((section) => <li key={section.id}><a href={`#${section.id}`} className="underline decoration-dotted underline-offset-4">{section.title}</a></li>)}
            <li><a href="#faq" className="underline decoration-dotted underline-offset-4">よくある質問</a></li>
          </ol>
        </nav>

        <div className="space-y-10">
          {guide.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-6">
              <h2 className="mb-4 text-xl font-bold leading-relaxed">{section.title}</h2>
              <div className="space-y-4 text-sm leading-8">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              {section.bullets && (
                <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-7">
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              )}
              {section.example && (
                <figure className="card card-flat mt-5 overflow-hidden p-4">
                  <figcaption className="mb-3 text-xs font-semibold" style={{ color: "var(--c-primary)" }}>{section.example.label}</figcaption>
                  <blockquote className="whitespace-pre-wrap break-words text-sm leading-7">{section.example.text}</blockquote>
                </figure>
              )}
            </section>
          ))}
        </div>

        <section id="faq" className="mt-10 scroll-mt-6">
          <h2 className="text-xl font-bold">よくある質問</h2>
          <dl className="mt-5 space-y-6">
            {guide.faq.map((item) => (
              <div key={item.question}>
                <dt className="text-sm font-bold leading-7">{item.question}</dt>
                <dd className="mt-2 text-sm leading-7">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="mt-8 border-t pt-5 text-xs leading-6" style={{ borderColor: "var(--c-border)", color: "var(--c-textMuted)" }}>
          このガイドはBukuchaの機能と<Link href="/legal/guideline" className="underline underline-offset-2">投稿・表現ガイドライン</Link>に基づいて作成しています。操作名や利用できる機能は、ログイン状態や今後の更新によって異なる場合があります。入力例は、特定の返答を保証するものではありません。
        </footer>
      </article>

      <GuideCta {...guide.cta} />

      <nav aria-label="関連記事" className="mt-10">
        <h2 className="text-sm font-bold">あわせて読みたい</h2>
        <ul className="mt-4 space-y-3">
          {related.map((item) => (
            <li key={item.slug}>
              <Link href={`/guides/${item.slug}`} className="card card-flat block p-4 text-sm font-semibold leading-7">
                <span className="mb-1 block text-xs font-normal" style={{ color: "var(--c-textMuted)" }}>{item.category}</span>
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </GuideLayout>
  );
}
