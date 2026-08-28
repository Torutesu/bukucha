import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { storyDetail } from "@/server/stories";
import { brand } from "@/lib/theme";
import { StoryDetailClient } from "./StoryDetailClient";

/**
 * SCR-005: the public story page.
 *
 * Server-rendered, readable signed out, and indexable. The benchmark keeps
 * every story behind a client-side app, which means none of its catalogue is
 * reachable from a search for a title or a character — the one query readers in
 * this market actually run (research/na-market.md §1).
 */

type Params = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  const user = await getSessionUser();
  try {
    return await storyDetail(user, slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const s = await load(slug);
  if (!s) return { title: `Not found — ${brand.name}` };
  const description = s.logline || s.worldSetting.slice(0, 160);
  return {
    title: `${s.title} — ${brand.name}`,
    description,
    alternates: { canonical: `/story/${s.slug}` },
    openGraph: {
      type: "article",
      title: s.title,
      description,
      siteName: brand.name,
      ...(s.coverImageUrl ? { images: [s.coverImageUrl] } : {}),
    },
    twitter: { card: "summary_large_image", title: s.title, description },
  };
}

export default async function StoryPage({ params }: Params) {
  const { slug } = await params;
  const story = await load(slug);
  if (!story) notFound();

  const totalEndings = story.intros.reduce((n, i) => n + i.endings.length, 0);
  const foundEndings = story.endingsFound.length;

  // The crawlable body. The client island below owns everything interactive.
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            name: story.title,
            description: story.logline,
            author: { "@type": "Person", name: story.author.displayName },
            genre: story.tags.map((t) => t.tag.name),
            datePublished: story.publishedAt?.toISOString(),
            isAccessibleForFree: true,
          }),
        }}
      />
      <noscript>
        <article className="px-4 py-6">
          <h1>{story.title}</h1>
          <p>{story.logline}</p>
          <p>by {story.author.displayName}</p>
          <p>{story.worldSetting}</p>
          {story.intros[0] && <p>{story.intros[0].introText}</p>}
          <p>
            <Link href={`/login?returnTo=/story/${story.slug}`}>Sign in to play this story</Link>
          </p>
        </article>
      </noscript>
      <StoryDetailClient
        initial={JSON.parse(JSON.stringify(story))}
        totalEndings={totalEndings}
        foundEndings={foundEndings}
      />
    </>
  );
}
