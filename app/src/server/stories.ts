import { db } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { ruleCheck, visibleLevels } from "@/lib/policy";
import { llm } from "@/lib/llm";
import { buildAdaptationMessages, buildDraftMessages } from "@/lib/prompt";
import { storySlug } from "@/lib/slug";
import { brand } from "../../brand.config";
import { FIRST_CHECK_TURN } from "./endings";
import type { Comparator, ContentLevel, EndingRarity, Prisma, User } from "@prisma/client";

/** Card projection — spec 03-api.md, StoryCard. */
export const cardSelect = {
  id: true,
  title: true,
  logline: true,
  coverImageUrl: true,
  contentLevel: true,
  likeCount: true,
  playerCount: true,
  routeCount: true,
  publishedAt: true,
  slug: true,
  endingCount: true,
  source: true,
  tags: { select: { tag: { select: { id: true, name: true } } }, take: 3 },
} satisfies Prisma.StorySelect;

export function publishedWhere(user: User | null): Prisma.StoryWhereInput {
  return {
    status: "PUBLISHED",
    contentLevel: { in: visibleLevels(user) },
  };
}

export async function homeSections(user: User | null) {
  const where = publishedWhere(user);
  const prefTags = user?.preferenceTags ?? [];
  const [originals, forYou, popular, newest] = await Promise.all([
    db.story.findMany({
      where: { ...where, source: { in: ["EDITORIAL", "ADAPTED"] }, featuredAt: { not: null } },
      select: cardSelect,
      orderBy: [{ featuredAt: "desc" }],
      take: 10,
    }),
    prefTags.length
      ? db.story.findMany({
          where: { ...where, tags: { some: { tag: { name: { in: prefTags } } } } },
          select: cardSelect,
          orderBy: [{ routeCount: "desc" }],
          take: 10,
        })
      : db.story.findMany({
          where,
          select: cardSelect,
          orderBy: [{ likeCount: "desc" }],
          take: 10,
        }),
    db.story.findMany({
      where,
      select: cardSelect,
      orderBy: [{ routeCount: "desc" }],
      take: 10,
    }),
    db.story.findMany({
      where,
      select: cardSelect,
      orderBy: [{ publishedAt: "desc" }],
      take: 10,
    }),
  ]);
  return [
    // Supply is seeded, not organic, so the shelf that says "someone built this
    // on purpose" leads. It is also the answer to an empty-catalogue launch.
    { key: "originals", title: "HEADCANON Originals", stories: originals },
    { key: "forYou", title: "For you", stories: forYou },
    { key: "popular", title: "Being played right now", stories: popular },
    { key: "new", title: "New this week", stories: newest },
  ].filter((s) => s.stories.length > 0);
}

export async function recommend(user: User | null, tagNames: string[]) {
  const where = publishedWhere(user);
  const matched = await db.story.findMany({
    where: tagNames.length
      ? { ...where, tags: { some: { tag: { name: { in: tagNames } } } } }
      : where,
    select: cardSelect,
    orderBy: [{ routeCount: "desc" }],
    take: 3,
  });
  if (matched.length >= 3) return { items: matched, fallback: false };
  const popular = await db.story.findMany({
    where,
    select: cardSelect,
    orderBy: [{ routeCount: "desc" }],
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
  const where: Prisma.StoryWhereInput = {
    ...publishedWhere(user),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { logline: { contains: q } },
            { worldSetting: { contains: q } },
          ],
        }
      : {}),
    ...(tagNames.length
      ? { AND: tagNames.map((name) => ({ tags: { some: { tag: { name } } } })) }
      : {}),
  };
  const take = 20;
  const items = await db.story.findMany({
    where,
    select: cardSelect,
    orderBy: sort === "new" ? [{ publishedAt: "desc" }, { id: "desc" }] : [{ routeCount: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const nextCursor = items.length > take ? items[take].id : null;
  return { items: items.slice(0, take), nextCursor };
}

/**
 * Story detail by slug or id.
 *
 * This is the page search engines see. In this market readers search for a
 * title or a character, not for an app (research/na-market.md §1), so the page
 * is server-rendered and readable without an account — which is exactly what
 * the benchmark's single-page app gives up.
 */
export async function storyDetail(user: User | null, idOrSlug: string) {
  const s = await db.story.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      characters: { orderBy: { sortOrder: "asc" } },
      intros: {
        orderBy: { sortOrder: "asc" },
        include: {
          stats: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, icon: true } },
          endings: { orderBy: { sortOrder: "asc" }, select: { id: true, rarity: true, hint: true } },
        },
      },
      tags: { include: { tag: true } },
      author: { select: { id: true, handle: true, displayName: true } },
      license: { select: { rightsHolder: true, sourceTitle: true, exclusive: true } },
    },
  });
  if (!s) throw new HttpError(404, "not_found", "This story isn't available.");
  const isOwner = user?.id === s.authorId;
  if (!isOwner) {
    if (s.status === "SUSPENDED")
      throw new HttpError(404, "suspended", "This story is not currently published.");
    if (s.status !== "PUBLISHED")
      throw new HttpError(404, "not_found", "This story isn't available.");
    if (!visibleLevels(user).includes(s.contentLevel))
      throw new HttpError(404, "not_visible", "This story isn't available.");
  }
  const likedByMe = user
    ? !!(await db.like.findUnique({
        where: { userId_storyId: { userId: user.id, storyId: s.id } },
      }))
    : false;
  const endingsFound = user
    ? await db.endingReached.findMany({
        where: { userId: user.id, storyId: s.id },
        select: { endingDefId: true },
        distinct: ["endingDefId"],
      })
    : [];
  return { ...s, likedByMe, endingsFound: endingsFound.map((e) => e.endingDefId) };
}

export async function toggleLike(user: User, storyId: string, on: boolean) {
  const key = { userId_storyId: { userId: user.id, storyId } };
  const existing = await db.like.findUnique({ where: key });
  if (on && !existing) {
    await db.$transaction([
      db.like.create({ data: { userId: user.id, storyId } }),
      db.story.update({
        where: { id: storyId },
        data: { likeCount: { increment: 1 } },
      }),
    ]);
  } else if (!on && existing) {
    await db.$transaction([
      db.like.delete({ where: key }),
      db.story.update({
        where: { id: storyId },
        data: { likeCount: { decrement: 1 } },
      }),
    ]);
  }
  const s = await db.story.findUniqueOrThrow({
    where: { id: storyId },
    select: { likeCount: true },
  });
  return { likeCount: s.likeCount };
}

// ============ Authoring (SCR-009 / SCR-010 / SCR-011) ============

export async function requireOwnedStory(user: User, id: string) {
  const s = await db.story.findUnique({
    where: { id },
    include: {
      characters: { orderBy: { sortOrder: "asc" } },
      intros: {
        orderBy: { sortOrder: "asc" },
        include: {
          stats: { orderBy: { sortOrder: "asc" }, include: { levels: { orderBy: { threshold: "asc" } } } },
          endings: { orderBy: { sortOrder: "asc" }, include: { rules: true } },
        },
      },
      keywords: { orderBy: { sortOrder: "asc" } },
      tags: { include: { tag: true } },
      license: true,
    },
  });
  if (!s) throw new HttpError(404, "not_found");
  if (s.authorId !== user.id) throw new HttpError(403, "forbidden");
  return s;
}

/** Blank start: one character and one intro so the builder is never empty. */
export async function createBlankStory(user: User) {
  return db.story.create({
    data: {
      authorId: user.id,
      slug: storySlug("untitled"),
      title: "",
      characters: {
        create: {
          name: "Unnamed",
          personality: "",
          speechStyle: "",
          relationship: "",
          exampleDialogs: [],
          sortOrder: 0,
        },
      },
      intros: { create: { label: "Opening", introText: "", firstMessage: "", sortOrder: 0 } },
    },
    include: { characters: true, intros: true, tags: { include: { tag: true } } },
  });
}

interface DraftShape {
  title?: string;
  logline?: string;
  worldSetting?: string;
  characters?: {
    name?: string;
    personality?: string;
    speechStyle?: string;
    relationship?: string;
    exampleDialogs?: { user?: string; char?: string }[];
  }[];
  intros?: { label?: string; introText?: string; firstMessage?: string; playGuide?: string }[];
  stats?: {
    key?: string;
    name?: string;
    icon?: string;
    initialValue?: number;
    minValue?: number;
    maxValue?: number;
    changeRule?: string;
    levels?: { name?: string; threshold?: number; prompt?: string }[];
  }[];
  endings?: {
    name?: string;
    rarity?: string;
    minTurns?: number;
    prompt?: string;
    epilogue?: string;
    hint?: string;
    rules?: { statKey?: string; comparator?: string; value?: number }[];
  }[];
  keywords?: { keywords?: string[]; body?: string }[];
  suggestedTags?: string[];
}

const RARITIES: EndingRarity[] = ["N", "R", "SR", "SSR"];

/**
 * AIF-005: one line of premise becomes a whole playable story — world, cast,
 * two intros, stats with named levels, four endings and a keyword book.
 *
 * The benchmark spreads the same work over an eight-step wizard with a separate
 * AI-assist button per field. Generating the whole thing first and letting the
 * author edit is what makes finishing likely.
 */
export async function createDraftFromPremise(user: User, premise: string) {
  if (premise.trim().length < 10 || premise.length > 400)
    throw new HttpError(422, "invalid_premise", "Give us 10 to 400 characters to work with.");
  const draft = await generate(buildDraftMessages(premise));
  return persistDraft(user, draft, { seed: premise, source: "ORIGINAL" });
}

/**
 * AIF-015: adapt prose that already exists into a playable story.
 *
 * Used two ways, and deliberately the same code for both: editorial producing
 * launch stock from its own drafts, and a licensed adaptation of an existing
 * work. The licence record is what separates them, not the pipeline.
 */
export async function createDraftFromProse(
  user: User,
  prose: string,
  meta: {
    sourceTitle?: string;
    sourceUrl?: string;
    rightsHolder?: string;
    author?: string;
    licensed?: boolean;
    revenueShareBps?: number;
    termEndsAt?: string;
  }
) {
  if (prose.trim().length < 400)
    throw new HttpError(422, "prose_too_short", "Paste at least a few hundred words to adapt.");
  if (meta.licensed && !meta.rightsHolder?.trim())
    throw new HttpError(
      422,
      "rights_holder_required",
      "An adaptation needs the name of whoever owns the work."
    );
  const draft = await generate(buildAdaptationMessages(prose, meta));
  return persistDraft(user, draft, {
    seed: `adapted from: ${meta.sourceTitle ?? "untitled source"}`,
    source: meta.licensed ? "ADAPTED" : "EDITORIAL",
    license: meta.licensed
      ? {
          kind: "ADAPTATION_OPTION" as const,
          rightsHolder: meta.rightsHolder!.slice(0, 200),
          sourceTitle: meta.sourceTitle?.slice(0, 200) ?? null,
          sourceUrl: meta.sourceUrl?.slice(0, 500) ?? null,
          // We never take exclusivity. See StoryLicense in the schema.
          exclusive: false,
          revenueShareBps: Math.max(0, Math.min(10000, meta.revenueShareBps ?? 2500)),
          termStartsAt: new Date(),
          termEndsAt: meta.termEndsAt ? new Date(meta.termEndsAt) : null,
        }
      : { kind: "PLATFORM_ORIGINAL" as const, rightsHolder: user.displayName },
  });
}

async function generate(messages: Parameters<ReturnType<typeof llm>["complete"]>[1]) {
  const parse = (raw: string) => JSON.parse(raw.replace(/^```json?\s*|```\s*$/g, "")) as DraftShape;
  try {
    return parse(await llm().complete("draft", messages, { json: true }));
  } catch {
    // One retry, then let the error surface — a half-built story is worse than none.
    return parse(await llm().complete("draft", messages, { json: true }));
  }
}

interface PersistOptions {
  seed: string;
  source: "ORIGINAL" | "EDITORIAL" | "ADAPTED";
  license?: {
    kind: "PLATFORM_ORIGINAL" | "ADAPTATION_OPTION";
    rightsHolder: string;
    sourceTitle?: string | null;
    sourceUrl?: string | null;
    exclusive?: boolean;
    revenueShareBps?: number;
    termStartsAt?: Date;
    termEndsAt?: Date | null;
  };
}

async function persistDraft(user: User, draft: DraftShape, opts: PersistOptions) {
  const tags = await db.tag.findMany({ where: { name: { in: draft.suggestedTags ?? [] } } });
  const title = (draft.title ?? "").slice(0, 80);

  const story = await db.story.create({
    data: {
      authorId: user.id,
      slug: storySlug(title || opts.seed),
      title,
      logline: (draft.logline ?? "").slice(0, 140),
      worldSetting: (draft.worldSetting ?? "").slice(0, 4000),
      aiDraftInput: opts.seed,
      source: opts.source,
      ...(opts.license ? { license: { create: opts.license } } : {}),
      characters: {
        create: (draft.characters ?? []).slice(0, 3).map((c, i) => ({
          name: (c.name ?? "Unnamed").slice(0, 40),
          personality: c.personality ?? "",
          speechStyle: c.speechStyle ?? "",
          relationship: c.relationship ?? "",
          exampleDialogs: (c.exampleDialogs ?? []).slice(0, 5) as Prisma.InputJsonValue,
          sortOrder: i,
        })),
      },
      keywords: {
        create: (draft.keywords ?? [])
          .filter((k) => k.body)
          .slice(0, 8)
          .map((k, i) => ({
            keywords: (k.keywords ?? []).slice(0, 8).map((w) => String(w).slice(0, 40)),
            body: k.body!.slice(0, 600),
            sortOrder: i,
          })),
      },
      tags: { create: tags.map((t) => ({ tagId: t.id })) },
    },
  });

  // Intros carry the stats and endings, so they are built one at a time and the
  // ending rules are wired up by stat key afterwards.
  for (const [i, iv] of (draft.intros ?? []).slice(0, 3).entries()) {
    const intro = await db.intro.create({
      data: {
        storyId: story.id,
        label: (iv.label ?? "Opening").slice(0, 60),
        introText: (iv.introText ?? "").slice(0, 2000),
        firstMessage: (iv.firstMessage ?? "").slice(0, 2000),
        playGuide: (iv.playGuide ?? "").slice(0, 300),
        sortOrder: i,
      },
    });

    const statIdByKey = new Map<string, string>();
    for (const [j, st] of (draft.stats ?? []).slice(0, 7).entries()) {
      const key = (st.key ?? `stat${j}`).toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 24);
      if (!key || statIdByKey.has(key)) continue;
      const min = Number.isFinite(st.minValue) ? st.minValue! : 0;
      const max = Number.isFinite(st.maxValue) ? st.maxValue! : 100;
      const created = await db.statDef.create({
        data: {
          introId: intro.id,
          key,
          name: (st.name ?? key).slice(0, 40),
          icon: (st.icon ?? "").slice(0, 4),
          initialValue: Math.max(min, Math.min(max, st.initialValue ?? min)),
          minValue: min,
          maxValue: max,
          changeRule: (st.changeRule ?? "").slice(0, 600),
          sortOrder: j,
          levels: {
            create: (st.levels ?? []).slice(0, 4).map((l, k) => ({
              name: (l.name ?? "").slice(0, 40),
              threshold: Number.isFinite(l.threshold) ? l.threshold! : 0,
              prompt: (l.prompt ?? "").slice(0, 300),
              sortOrder: k,
            })),
          },
        },
      });
      statIdByKey.set(key, created.id);
    }

    for (const [j, en] of (draft.endings ?? []).slice(0, 9).entries()) {
      const rarity = RARITIES.includes(en.rarity as EndingRarity)
        ? (en.rarity as EndingRarity)
        : "N";
      const rules = (en.rules ?? [])
        .slice(0, 7)
        .map((r) => ({
          statDefId: statIdByKey.get((r.statKey ?? "").toLowerCase()),
          comparator: (r.comparator === "LT" ? "LT" : "GTE") as Comparator,
          value: Number.isFinite(r.value) ? r.value! : 0,
        }))
        .filter((r): r is { statDefId: string; comparator: Comparator; value: number } =>
          Boolean(r.statDefId)
        );
      await db.endingDef.create({
        data: {
          introId: intro.id,
          name: (en.name ?? "An ending").slice(0, 80),
          rarity,
          minTurns: Math.max(FIRST_CHECK_TURN, en.minTurns ?? FIRST_CHECK_TURN),
          prompt: (en.prompt ?? "").slice(0, 600),
          epilogue: (en.epilogue ?? "").slice(0, 2000),
          hint: (en.hint ?? "").slice(0, 200),
          sortOrder: j,
          rules: { create: rules.map((r, k) => ({ ...r, sortOrder: k })) },
        },
      });
    }
  }

  return requireOwnedStory(user, story.id);
}

/** AIF-009: publish-time check. Fails closed. */
export async function publishStory(
  user: User,
  id: string,
  visibility: "PUBLISHED" | "UNLISTED" | "PRIVATE"
) {
  const s = await requireOwnedStory(user, id);

  // We publish original work only. A character card brought in from another
  // service is almost always someone else's fan work, so it stays private —
  // playable by the person who imported it and by nobody else. This is the
  // line the benchmark blurs by banning fan fiction in policy while shipping a
  // Fan Fiction category (research/ooc.md §7-8).
  if (s.source === "IMPORTED" && visibility !== "PRIVATE") {
    throw new HttpError(
      403,
      "import_is_private",
      "Imported cards stay private. Only you can play this one — write an original to publish."
    );
  }

  if (visibility !== "PUBLISHED") {
    await db.story.update({ where: { id }, data: { status: visibility } });
    return { status: visibility };
  }

  if (!s.title.trim()) throw new HttpError(422, "title_required", "Your story needs a title.");
  if (!s.intros.length || !s.intros[0].firstMessage.trim())
    throw new HttpError(422, "intro_required", "Write the opening scene before you publish.");

  const fullText = [
    s.title,
    s.logline,
    s.worldSetting,
    ...s.characters.flatMap((c) => [c.name, c.personality, c.speechStyle, c.relationship]),
    ...s.intros.flatMap((i) => [i.label, i.introText, i.firstMessage]),
  ].join("\n");

  const { ipDetected, banned } = ruleCheck(fullText);
  const blocked: { kind: string; detail: string }[] = [];
  for (const name of ipDetected) {
    blocked.push({
      kind: "IP_DETECTED",
      detail: `This looks like it uses an existing work or character ("${name}"). ${brand.name} publishes original work only — rename it and try again.`,
    });
  }
  for (const label of banned) {
    blocked.push({ kind: "BANNED_EXPRESSION", detail: `This crosses our content policy (${label}).` });
  }

  let judged: ContentLevel | "OVER" = "ALL_AGES";
  try {
    const raw = await llm().complete("judge", [
      {
        role: "system",
        content:
          'Rate this story text and output JSON only: {"ok":bool,"level":"ALL_AGES"|"TEEN"|"OVER"}. TEEN = charged, suggestive, sensual writing. OVER = explicit sexual acts or explicit anatomy.',
      },
      { role: "user", content: fullText.slice(0, 8000) },
    ]);
    const j = JSON.parse(raw.replace(/^```json?\s*|```\s*$/g, ""));
    judged = j.level === "TEEN" ? "TEEN" : j.level === "OVER" ? "OVER" : "ALL_AGES";
  } catch {
    throw new HttpError(503, "moderation_unavailable", "We couldn't finish the check. Try again in a minute.");
  }
  if (judged === "OVER") {
    blocked.push({
      kind: "CONTENT_OVER_LINE",
      detail: "This goes past what we can publish (explicit sexual content).",
    });
  }

  if (blocked.length) {
    await db.moderationFlag.createMany({
      data: blocked.map((b) => ({
        storyId: id,
        targetType: "story",
        targetId: id,
        kind: b.kind as "IP_DETECTED" | "CONTENT_OVER_LINE" | "BANNED_EXPRESSION",
        detail: b.detail,
      })),
    });
    return { blocked };
  }

  // If the judge rates it higher than the author declared, the judge wins.
  const finalLevel: ContentLevel =
    judged === "TEEN" && s.contentLevel === "ALL_AGES" ? "TEEN" : s.contentLevel;

  await db.story.update({
    where: { id },
    data: { status: "PUBLISHED", contentLevel: finalLevel, publishedAt: s.publishedAt ?? new Date() },
  });
  return { status: "PUBLISHED" as const };
}
