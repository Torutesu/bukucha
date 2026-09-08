import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser, HttpError } from "@/lib/auth";
import { cardSelect, situationDetail } from "@/server/situations";
import type { CardData } from "@/components/SituationCard";

/** Only fields displayed by the detail UI may cross the server/client boundary. */
export interface SituationPageDetail {
  id: string;
  title: string;
  catchphrase: string;
  worldSetting: string;
  coverImageUrl: string | null;
  contentLevel: "ALL_AGES" | "R15" | "R18";
  likeCount: number;
  readerCount: number;
  storyCount: number;
  publishedAt: string | null;
  likedByMe: boolean;
  author: { nickname: string };
  characters: {
    id: string;
    name: string;
    profileImageUrl: string | null;
    personality: string;
    speechStyle: string;
    relationship: string;
  }[];
  intros: { id: string; label: string; introText: string; firstMessagePreview: string }[];
  tags: { tag: { id: string; name: string } }[];
}

export interface ContinueStory {
  id: string;
  count: number;
}

// React cache only deduplicates within a request. Authorized data is never put
// into a shared cache or used to populate public search/social metadata.
export const getAuthorizedSituation = cache(async (id: string) => {
  const user = await getSessionUser();
  try {
    const situation = await situationDetail(user, id);
    return { user, situation };
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    // A database outage must remain a server error, never a false deletion.
    throw error;
  }
});

/** An anonymous, indexable record: no owner, age or filter exceptions. */
export const getIndexableSituation = cache(async (id: string) =>
  db.situation.findFirst({
    where: { id, status: "PUBLISHED", contentLevel: "ALL_AGES" },
    select: {
      id: true,
      title: true,
      catchphrase: true,
      worldSetting: true,
      publishedAt: true,
      author: { select: { nickname: true } },
      tags: { select: { tag: { select: { id: true, name: true } } } },
    },
  })
);

export async function getSituationPageData(id: string) {
  const { user, situation: s } = await getAuthorizedSituation(id);
  const firstTag = s.tags[0]?.tag.id;
  const [related, lastStory] = await Promise.all([
    firstTag
      ? db.situation.findMany({
          where: {
            id: { not: id },
            status: "PUBLISHED",
            contentLevel: "ALL_AGES",
            tags: { some: { tagId: firstTag } },
          },
          select: cardSelect,
          orderBy: [{ storyCount: "desc" }, { id: "desc" }],
          take: 6,
        })
      : [],
    user
      ? db.story.findFirst({
          where: { userId: user.id, situationId: id, status: "ACTIVE" },
          orderBy: { lastMessageAt: "desc" },
          select: {
            id: true,
            messages: {
              where: { isDeleted: false },
              orderBy: { idx: "desc" },
              take: 1,
              select: { idx: true },
            },
          },
        })
      : null,
  ]);

  const detail: SituationPageDetail = {
    id: s.id,
    title: s.title,
    catchphrase: s.catchphrase,
    worldSetting: s.worldSetting,
    coverImageUrl: s.coverImageUrl,
    contentLevel: s.contentLevel,
    likeCount: s.likeCount,
    readerCount: s.readerCount,
    storyCount: s.storyCount,
    publishedAt: s.publishedAt?.toISOString() ?? null,
    likedByMe: s.likedByMe,
    author: { nickname: s.author.nickname },
    characters: s.characters.map((character) => ({
      id: character.id,
      name: character.name,
      profileImageUrl: character.profileImageUrl,
      personality: character.personality,
      speechStyle: character.speechStyle,
      relationship: character.relationship,
    })),
    intros: s.intros.map((intro) => ({
      id: intro.id,
      label: intro.label,
      introText: intro.introText,
      // The existing UI displays a short excerpt. The full generation prompt
      // and unseen continuation must not be serialized into the HTML/RSC.
      firstMessagePreview: intro.firstMessage
        ? `${intro.firstMessage.slice(0, 160)}${intro.firstMessage.length > 160 ? "…" : ""}`
        : "",
    })),
    tags: s.tags.map(({ tag }) => ({ tag: { id: tag.id, name: tag.name } })),
  };

  return {
    detail,
    isLoggedIn: Boolean(user),
    continueStory: lastStory
      ? { id: lastStory.id, count: lastStory.messages[0]?.idx ?? 0 }
      : null,
    related: related.map((card): CardData => ({
      id: card.id,
      title: card.title,
      catchphrase: card.catchphrase,
      coverImageUrl: card.coverImageUrl,
      contentLevel: card.contentLevel,
      likeCount: card.likeCount,
      readerCount: card.readerCount,
      storyCount: card.storyCount,
      author: { nickname: card.author.nickname },
      tags: card.tags.map(({ tag }) => ({ tag: { id: tag.id, name: tag.name } })),
    })),
  };
}
