import { db } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { ruleCheck, visibleLevels } from "@/lib/policy";
import { llm } from "@/lib/llm";
import { buildDraftMessages } from "@/lib/prompt";
import type { ContentLevel, Prisma, User } from "@prisma/client";

/** カード用select(03-api.md SituationCard) */
export const cardSelect = {
  id: true,
  title: true,
  catchphrase: true,
  coverImageUrl: true,
  contentLevel: true,
  likeCount: true,
  readerCount: true,
  storyCount: true,
  publishedAt: true,
  author: { select: { nickname: true } },
  tags: { select: { tag: { select: { id: true, name: true } } }, take: 2 },
} satisfies Prisma.SituationSelect;

export function publishedWhere(user: User | null): Prisma.SituationWhereInput {
  return {
    status: "PUBLISHED",
    contentLevel: { in: visibleLevels(user) },
  };
}

export async function homeSections(user: User | null) {
  const where = publishedWhere(user);
  const prefTags = user?.preferenceTags ?? [];
  const [forYou, popular, newest] = await Promise.all([
    prefTags.length
      ? db.situation.findMany({
          where: { ...where, tags: { some: { tag: { name: { in: prefTags } } } } },
          select: cardSelect,
          orderBy: [{ storyCount: "desc" }],
          take: 10,
        })
      : db.situation.findMany({
          where,
          select: cardSelect,
          orderBy: [{ likeCount: "desc" }],
          take: 10,
        }),
    db.situation.findMany({
      where,
      select: cardSelect,
      orderBy: [{ storyCount: "desc" }],
      take: 10,
    }),
    db.situation.findMany({
      where,
      select: cardSelect,
      orderBy: [{ publishedAt: "desc" }],
      take: 10,
    }),
  ]);
  return [
    { key: "forYou", title: "あなたへ", situations: forYou },
    { key: "popular", title: "いま人気の物語", situations: popular },
    { key: "new", title: "新着", situations: newest },
  ];
}

export async function recommend(user: User | null, tagNames: string[]) {
  const where = publishedWhere(user);
  const matched = await db.situation.findMany({
    where: tagNames.length
      ? { ...where, tags: { some: { tag: { name: { in: tagNames } } } } }
      : where,
    select: cardSelect,
    orderBy: [{ storyCount: "desc" }],
    take: 3,
  });
  if (matched.length >= 3) return { items: matched, fallback: false };
  const popular = await db.situation.findMany({
    where,
    select: cardSelect,
    orderBy: [{ storyCount: "desc" }],
    take: 3,
  });
  return { items: popular, fallback: true };
}

export async function search(
  user: User | null,
  q: string,
  tagNames: string[],
  sort: "popular" | "new",
  cursor?: string
) {
  const where: Prisma.SituationWhereInput = {
    ...publishedWhere(user),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { catchphrase: { contains: q } },
            { worldSetting: { contains: q } },
          ],
        }
      : {}),
    ...(tagNames.length
      ? { AND: tagNames.map((name) => ({ tags: { some: { tag: { name } } } })) }
      : {}),
  };
  const take = 20;
  const items = await db.situation.findMany({
    where,
    select: cardSelect,
    orderBy: sort === "new" ? [{ publishedAt: "desc" }, { id: "desc" }] : [{ storyCount: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const nextCursor = items.length > take ? items[take].id : null;
  return { items: items.slice(0, take), nextCursor };
}

export async function situationDetail(user: User | null, id: string) {
  const s = await db.situation.findUnique({
    where: { id },
    include: {
      characters: { orderBy: { sortOrder: "asc" } },
      intros: { orderBy: { sortOrder: "asc" } },
      tags: { include: { tag: true } },
      author: { select: { id: true, nickname: true } },
    },
  });
  if (!s) throw new HttpError(404, "not_found", "この物語は表示できません");
  const isOwner = user?.id === s.authorId;
  if (!isOwner) {
    if (s.status === "SUSPENDED")
      throw new HttpError(404, "suspended", "この物語は現在公開されていません");
    if (s.status !== "PUBLISHED")
      throw new HttpError(404, "not_found", "この物語は表示できません");
    if (!visibleLevels(user).includes(s.contentLevel))
      throw new HttpError(404, "not_visible", "この物語は表示できません");
  }
  const likedByMe = user
    ? !!(await db.like.findUnique({
        where: { userId_situationId: { userId: user.id, situationId: id } },
      }))
    : false;
  return { ...s, likedByMe };
}

export async function toggleLike(user: User, situationId: string, on: boolean) {
  const key = { userId_situationId: { userId: user.id, situationId } };
  const existing = await db.like.findUnique({ where: key });
  if (on && !existing) {
    await db.$transaction([
      db.like.create({ data: { userId: user.id, situationId } }),
      db.situation.update({
        where: { id: situationId },
        data: { likeCount: { increment: 1 } },
      }),
    ]);
  } else if (!on && existing) {
    await db.$transaction([
      db.like.delete({ where: key }),
      db.situation.update({
        where: { id: situationId },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
  }
  const s = await db.situation.findUniqueOrThrow({
    where: { id: situationId },
    select: { likeCount: true },
  });
  return { likeCount: s.likeCount };
}

// ============ 作成(SCR-009/010) ============

export async function requireOwnedSituation(user: User, id: string) {
  const s = await db.situation.findUnique({
    where: { id },
    include: { characters: { orderBy: { sortOrder: "asc" } }, intros: { orderBy: { sortOrder: "asc" } }, tags: { include: { tag: true } } },
  });
  if (!s) throw new HttpError(404, "not_found");
  if (s.authorId !== user.id) throw new HttpError(403, "forbidden");
  return s;
}

/** 白紙作成: デフォルトのキャラ1体+イントロ1件を持たせる(SCR-009) */
export async function createBlankSituation(user: User) {
  return db.situation.create({
    data: {
      authorId: user.id,
      title: "",
      characters: {
        create: {
          name: "名もなき彼",
          personality: "",
          speechStyle: "",
          relationship: "",
          exampleDialogs: [],
          sortOrder: 0,
        },
      },
      intros: {
        create: { label: "はじまり", introText: "", firstMessage: "", sortOrder: 0 },
      },
    },
    include: { characters: true, intros: true, tags: { include: { tag: true } } },
  });
}

/** AIF-002: 妄想→下書き */
export async function createDraftFromFantasy(user: User, fantasy: string) {
  if (fantasy.trim().length < 10 || fantasy.length > 200)
    throw new HttpError(422, "invalid_fantasy", "妄想は10〜200字で入力してください");
  const raw = await llm().complete("draft", buildDraftMessages(fantasy), { json: true });
  let draft: {
    title?: string;
    catchphrase?: string;
    worldSetting?: string;
    characters?: {
      name?: string;
      personality?: string;
      speechStyle?: string;
      relationship?: string;
      exampleDialogs?: { user?: string; char?: string }[];
    }[];
    intros?: { label?: string; introText?: string; firstMessage?: string }[];
    suggestedTags?: string[];
  };
  try {
    draft = JSON.parse(raw.replace(/^```json?\s*|```\s*$/g, ""));
  } catch {
    // AIF-002 fallback: リトライ1回
    const retry = await llm().complete("draft", buildDraftMessages(fantasy), { json: true });
    draft = JSON.parse(retry.replace(/^```json?\s*|```\s*$/g, ""));
  }
  const tags = await db.tag.findMany({
    where: { name: { in: draft.suggestedTags ?? [] } },
  });
  return db.situation.create({
    data: {
      authorId: user.id,
      title: (draft.title ?? "").slice(0, 60),
      catchphrase: (draft.catchphrase ?? "").slice(0, 60),
      worldSetting: (draft.worldSetting ?? "").slice(0, 4000),
      aiDraftInput: fantasy,
      characters: {
        create: (draft.characters ?? []).slice(0, 3).map((c, i) => ({
          name: (c.name ?? "彼").slice(0, 30),
          personality: c.personality ?? "",
          speechStyle: c.speechStyle ?? "",
          relationship: c.relationship ?? "",
          exampleDialogs: (c.exampleDialogs ?? []).slice(0, 5) as Prisma.InputJsonValue,
          sortOrder: i,
        })),
      },
      intros: {
        create: (draft.intros ?? []).slice(0, 3).map((iv, i) => ({
          label: (iv.label ?? "はじまり").slice(0, 30),
          introText: (iv.introText ?? "").slice(0, 2000),
          firstMessage: (iv.firstMessage ?? "").slice(0, 1000),
          sortOrder: i,
        })),
      },
      tags: { create: tags.map((t) => ({ tagId: t.id })) },
    },
    include: { characters: true, intros: true, tags: { include: { tag: true } } },
  });
}

/** AIF-006: 公開前チェック(fail-close) */
export async function publishSituation(
  user: User,
  id: string,
  visibility: "PUBLISHED" | "PRIVATE"
) {
  const s = await requireOwnedSituation(user, id);
  if (visibility === "PRIVATE") {
    await db.situation.update({ where: { id }, data: { status: "PRIVATE" } });
    return { status: "PRIVATE" as const };
  }

  if (!s.title.trim()) throw new HttpError(422, "title_required", "タイトルを入力してください");
  if (!s.intros.length || !s.intros[0].firstMessage.trim())
    throw new HttpError(422, "intro_required", "はじまりの場面を入力してください");

  const fullText = [
    s.title,
    s.catchphrase,
    s.worldSetting,
    ...s.characters.flatMap((c) => [c.name, c.personality, c.speechStyle, c.relationship]),
    ...s.intros.flatMap((i) => [i.label, i.introText, i.firstMessage]),
  ].join("\n");

  const { ipDetected, banned } = ruleCheck(fullText);
  const blocked: { kind: string; detail: string }[] = [];
  for (const name of ipDetected) {
    blocked.push({
      kind: "IP_DETECTED",
      detail: `既存作品のキャラクター・作品名が含まれています(検出: ${name})。Bukuchaはオリジナル作品のみ公開できます`,
    });
  }
  for (const label of banned) {
    blocked.push({ kind: "BANNED_EXPRESSION", detail: `表現ガイドラインの範囲を超えています(${label})` });
  }

  // LLM判定(コンテンツレベル)。fail-close
  let levelJudge: ContentLevel | "OVER" = "ALL_AGES";
  try {
    const raw = await llm().complete("judge", [
      {
        role: "system",
        content:
          '次の作品テキストの表現水準を判定しJSONのみ出力: {"ok":bool,"level":"ALL_AGES"|"R15"|"OVER"}。R15=官能的な緊張・比喩・状況描写あり。OVER=直接的な性行為描写・露骨な語あり。',
      },
      { role: "user", content: fullText.slice(0, 8000) },
    ]);
    const j = JSON.parse(raw.replace(/^```json?\s*|```\s*$/g, ""));
    levelJudge = j.level === "R15" ? "R15" : j.level === "OVER" ? "OVER" : "ALL_AGES";
  } catch {
    throw new HttpError(503, "moderation_unavailable", "確認中です。数分後にもう一度お試しください");
  }
  if (levelJudge === "OVER") {
    blocked.push({
      kind: "CONTENT_OVER_LINE",
      detail: "表現ガイドラインの範囲を超えています(直接的な性描写)",
    });
  }

  if (blocked.length) {
    await db.moderationFlag.createMany({
      data: blocked.map((b) => ({
        situationId: id,
        targetType: "situation",
        targetId: id,
        kind: b.kind as "IP_DETECTED" | "CONTENT_OVER_LINE" | "BANNED_EXPRESSION",
        detail: b.detail,
      })),
    });
    return { blocked };
  }

  // 申告より判定が高い場合は自動引き上げ(spec AIF-006)
  const finalLevel: ContentLevel =
    levelJudge === "R15" && s.contentLevel === "ALL_AGES" ? "R15" : s.contentLevel;

  await db.situation.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      contentLevel: finalLevel,
      publishedAt: s.publishedAt ?? new Date(),
    },
  });
  return { status: "PUBLISHED" as const };
}
