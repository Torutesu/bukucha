import { db } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { llm } from "@/lib/llm";
import { buildChatMessages, buildRecapMessages, buildSummaryMessages } from "@/lib/prompt";
import {
  CRISIS_RESOURCES,
  detectCrisis,
  disclosureDue,
  ratingProfile,
  visibleLevels,
} from "@/lib/policy";
import { resolveTier, type ModelTier } from "@/lib/quota";
import { applyStateUpdate, matchKeywords, selectCanon } from "./canon";
import { endingRadar, evaluateEndings } from "./endings";
import type { SseEvent } from "./sse";
import type { User } from "@prisma/client";

const RECENT_TURNS = 40;
/** How much recent prose the canon and keyword selectors look at. */
const RELEVANCE_WINDOW = 6;

export async function createRoute(
  user: User,
  storyId: string,
  introId: string,
  personaId?: string,
  fork?: { fromRouteId: string; atIdx: number }
) {
  const story = await db.story.findUnique({
    where: { id: storyId },
    include: { intros: { include: { stats: true } } },
  });
  if (!story) throw new HttpError(404, "not_found");
  if (story.authorId !== user.id) {
    if (story.status !== "PUBLISHED") throw new HttpError(404, "not_found");
    if (!visibleLevels(user).includes(story.contentLevel))
      throw new HttpError(404, "not_visible", "This story isn't available to you.");
  }
  const intro = story.intros.find((i) => i.id === introId);
  if (!intro) throw new HttpError(422, "invalid_intro");

  const persona =
    personaId ?? (await db.persona.findFirst({ where: { userId: user.id, isDefault: true } }))?.id;

  const firstPlay = !(await db.route.findFirst({ where: { userId: user.id, storyId } }));

  const route = await db.$transaction(async (tx) => {
    const r = await tx.route.create({
      data: {
        userId: user.id,
        storyId,
        introId,
        personaId: persona ?? null,
        forkedFromRouteId: fork?.fromRouteId ?? null,
        forkedAtIdx: fork?.atIdx ?? null,
        memory: { create: {} },
        messages: {
          create: [
            { idx: 0, role: "SYSTEM", content: intro.introText },
            { idx: 1, role: "AI", content: intro.firstMessage },
          ],
        },
        // Stats start at the values the creator set, not at zero.
        stats: {
          create: intro.stats.map((s) => ({ statDefId: s.id, value: s.initialValue })),
        },
      },
    });
    await tx.story.update({
      where: { id: storyId },
      data: {
        routeCount: { increment: 1 },
        ...(firstPlay ? { playerCount: { increment: 1 } } : {}),
      },
    });
    return r;
  });

  // SCR-008: a fork inherits everything the parent had settled up to the branch.
  if (fork) await copyForkState(fork.fromRouteId, route.id, fork.atIdx, user.id);

  return getRoute(user, route.id);
}

async function copyForkState(fromRouteId: string, toRouteId: string, atIdx: number, userId: string) {
  const parent = await db.route.findUnique({
    where: { id: fromRouteId },
    include: {
      canon: { where: { isActive: true } },
      stats: true,
      memory: true,
      messages: { where: { isDeleted: false, idx: { lte: atIdx } }, orderBy: { idx: "asc" } },
    },
  });
  if (!parent || parent.userId !== userId) return;
  await db.$transaction([
    db.routeMessage.deleteMany({ where: { routeId: toRouteId } }),
    db.routeMessage.createMany({
      data: parent.messages.map((m, i) => ({
        routeId: toRouteId,
        idx: i,
        role: m.role,
        content: m.content,
        choices: m.choices ?? undefined,
      })),
    }),
    db.canonFact.createMany({
      data: parent.canon
        .filter((f) => f.sourceTurn <= atIdx)
        .map((f) => ({
          routeId: toRouteId,
          category: f.category,
          subject: f.subject,
          statement: f.statement,
          sourceTurn: f.sourceTurn,
          pinned: f.pinned,
          source: f.source,
        })),
    }),
    ...parent.stats.map((s) =>
      db.statValue.upsert({
        where: { routeId_statDefId: { routeId: toRouteId, statDefId: s.statDefId } },
        update: { value: s.value },
        create: { routeId: toRouteId, statDefId: s.statDefId, value: s.value },
      })
    ),
    db.routeMemory.upsert({
      where: { routeId: toRouteId },
      update: { summary: parent.memory?.summary ?? "", userNote: parent.memory?.userNote ?? "" },
      create: {
        routeId: toRouteId,
        summary: parent.memory?.summary ?? "",
        userNote: parent.memory?.userNote ?? "",
      },
    }),
  ]);
}

export async function getRoute(user: User, id: string) {
  const route = await db.route.findUnique({
    where: { id },
    include: {
      story: { include: { characters: { orderBy: { sortOrder: "asc" } } } },
      intro: { include: { stats: { include: { levels: true }, orderBy: { sortOrder: "asc" } } } },
      persona: true,
      memory: true,
      canon: { where: { isActive: true }, orderBy: [{ pinned: "desc" }, { sourceTurn: "asc" }] },
      stats: true,
      messages: {
        where: { isDeleted: false },
        orderBy: { idx: "asc" },
        include: { deltas: { include: { statDef: { select: { name: true, icon: true } } } } },
      },
    },
  });
  if (!route || route.userId !== user.id) throw new HttpError(404, "not_found");
  return route;
}

export async function listRoutes(user: User, status: "ACTIVE" | "ENDED" | "ARCHIVED", storyId?: string) {
  return db.route.findMany({
    where: { userId: user.id, status, ...(storyId ? { storyId } : {}) },
    include: {
      story: { select: { id: true, slug: true, title: true, coverImageUrl: true } },
      messages: {
        where: { isDeleted: false },
        orderBy: { idx: "desc" },
        take: 1,
        select: { idx: true, content: true },
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });
}

/**
 * One turn, streamed. The order here is deliberate: safety first, then context
 * assembly, then generation, then bookkeeping. Nothing after the `done` event
 * can keep the reader waiting.
 */
export async function* routeTurn(
  user: User,
  routeId: string,
  input: {
    content: string;
    selectedChoiceId?: string;
    instruction?: string;
    rerollIdx?: number;
    tier?: ModelTier;
  }
): AsyncGenerator<SseEvent> {
  const route = await getRoute(user, routeId);
  const live = route.messages;

  // AIF-010: crisis handling pre-empts generation entirely. The model is never
  // asked to respond to this, and nothing is written into the story.
  if (detectCrisis(input.content)) {
    await db.safetyEvent.create({
      data: { userId: user.id, routeId, kind: "CRISIS_RESOURCE_SHOWN" },
    });
    yield { event: "crisis", data: CRISIS_RESOURCES };
    return;
  }

  // NY GBL Art. 47 / CA SB 243: periodic reminder that this is an AI.
  if (disclosureDue(route.lastDisclosureAt, user)) {
    await db.$transaction([
      db.route.update({ where: { id: routeId }, data: { lastDisclosureAt: new Date() } }),
      db.safetyEvent.create({ data: { userId: user.id, routeId, kind: "AI_DISCLOSURE" } }),
    ]);
    yield { event: "intermission", data: { reason: "disclosure" } };
  }

  let userInput = input.content;
  let historyEnd = live.length;
  let rerollTarget: number | null = null;

  if (input.rerollIdx !== undefined) {
    const target = live.find((m) => m.idx === input.rerollIdx && m.role === "AI");
    if (!target) throw new HttpError(422, "invalid_reroll");
    rerollTarget = target.idx;
    historyEnd = live.findIndex((m) => m.idx === target.idx);
    const prevUser = [...live.slice(0, historyEnd)].reverse().find((m) => m.role === "USER");
    userInput = prevUser?.content ?? "";
  }

  const recent = live
    .slice(Math.max(0, historyEnd - RECENT_TURNS), historyEnd)
    .filter((m) => m.role !== "SYSTEM");

  // Relevance signal for canon and keyword selection: the last few turns plus
  // what the reader is saying right now.
  const relevanceText = [...recent.slice(-RELEVANCE_WINDOW).map((m) => m.content), userInput].join(
    "\n"
  );

  const keywordEntries = await db.keywordEntry.findMany({ where: { storyId: route.storyId } });
  const statValues = new Map(route.stats.map((s) => [s.statDefId, s.value]));

  const { tier, downgraded, quota } = resolveTier(input.tier ?? "STANDARD", user);

  const messages = buildChatMessages({
    story: route.story,
    intro: route.intro,
    memory: route.memory,
    canon: selectCanon(route.canon, relevanceText),
    stats: route.intro.stats.map((def) => ({
      def,
      value: statValues.get(def.id) ?? def.initialValue,
    })),
    keywords: matchKeywords(keywordEntries, relevanceText, route.introId),
    persona: route.persona,
    recentMessages: recent,
    rating: ratingProfile(route.story.contentLevel, user),
    userInput,
  });

  if (downgraded) {
    yield { event: "tier", data: { tier, downgraded: true, resetsAt: quota.resetsAt } };
  }

  const userTurnsIncludingThis = live.filter((m) => m.role === "USER").length + 1;
  const wantChoices = rerollTarget === null && userTurnsIncludingThis % 2 === 0;

  const timeoutMs = Number(process.env.GENERATION_TIMEOUT_MS ?? 20_000);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  let full = "";
  let choices: { id: string; text: string }[] | null = null;
  let debug: Record<string, unknown> | undefined;

  try {
    const gen = llm().stream("chat", messages, {
      wantChoices,
      instruction: input.instruction,
      tier,
      signal: abort.signal,
    });
    for await (const chunk of gen) {
      if (chunk.type === "token" && chunk.token) {
        full += chunk.token;
        yield { event: "token", data: chunk.token };
      } else if (chunk.type === "blocked") {
        yield {
          event: "blocked",
          data: {
            message:
              "That turn crosses a line we hold, so the story didn't take it. Try steering somewhere else.",
          },
        };
        await db.$transaction([
          db.moderationFlag.create({
            data: {
              targetType: "message",
              targetId: routeId,
              kind: "CONTENT_OVER_LINE",
              detail: `blocked input on route ${routeId}`,
            },
          }),
          db.safetyEvent.create({
            data: { userId: user.id, routeId, kind: "OUTPUT_BLOCKED" },
          }),
        ]);
        return;
      } else if (chunk.type === "done") {
        full = chunk.content ?? full;
        choices = chunk.choices ?? null;
        debug = chunk.debug;
      }
    }
  } finally {
    clearTimeout(timer);
  }

  const saved = await db.$transaction(async (tx) => {
    if (tier === "CINEMATIC") {
      await tx.user.update({
        where: { id: user.id },
        data: {
          cinematicUsed: quota.cinematicUsed + 1,
          ...(quota.cinematicUsed === 0 ? { cinematicWindowAt: new Date() } : {}),
        },
      });
    }
    if (rerollTarget !== null) {
      return tx.routeMessage.update({
        where: { routeId_idx: { routeId, idx: rerollTarget } },
        data: {
          content: full,
          choices: choices ?? undefined,
          tier,
          modelUsed: process.env.LLM_PROVIDER ?? "openai",
        },
      });
    }
    const lastIdx = live.length ? live[live.length - 1].idx : -1;
    // Soft-deleted messages keep their idx, so never reuse one.
    const maxIdx = await tx.routeMessage.aggregate({ where: { routeId }, _max: { idx: true } });
    const base = Math.max(lastIdx, maxIdx._max.idx ?? -1);
    if (userInput.trim() || input.selectedChoiceId) {
      await tx.routeMessage.create({
        data: {
          routeId,
          idx: base + 1,
          role: "USER",
          content: userInput,
          selectedChoice: input.selectedChoiceId ?? null,
        },
      });
    }
    const ai = await tx.routeMessage.create({
      data: {
        routeId,
        idx: base + (userInput.trim() || input.selectedChoiceId ? 2 : 1),
        role: "AI",
        content: full,
        choices: choices ?? undefined,
        tier,
        modelUsed: process.env.LLM_PROVIDER ?? "openai",
      },
    });
    await tx.route.update({ where: { id: routeId }, data: { lastMessageAt: new Date() } });
    return ai;
  });

  yield {
    event: "done",
    data: {
      message: { idx: saved.idx, content: full, choices, tier },
      ...(process.env.LLM_PROVIDER === "mock" ? { debug } : {}),
    },
  };

  // --- bookkeeping: never metered, never blocking ---
  if (rerollTarget === null) {
    // AIF-001 + AIF-003. Awaited in E2E so assertions see a settled ledger.
    const stateWork = applyStateUpdate(routeId, saved.id, userTurnsIncludingThis, {
      user: userInput,
      ai: full,
    })
      .then(async () => {
        const deltas = await db.statDelta.findMany({
          where: { messageId: saved.id },
          include: { statDef: { select: { key: true, name: true, icon: true } } },
        });
        return deltas;
      })
      .catch(() => []);

    const deltas = await stateWork;
    if (deltas.length) {
      yield {
        event: "stats",
        data: deltas.map((d) => ({
          key: d.statDef.key,
          name: d.statDef.name,
          icon: d.statDef.icon,
          delta: d.delta,
          reason: d.reason,
        })),
      };
    }

    // AIF-004: conditions are deterministic, so this is free to run every turn.
    const ending = await evaluateEndings(routeId).catch(() => null);
    if (ending) {
      yield { event: "ending", data: ending };
    } else {
      const radar = await endingRadar(routeId).catch(() => []);
      const close = radar.filter((r) => !r.reached && r.progress >= 0.7);
      if (close.length) yield { event: "radar", data: close };
    }

    if (userTurnsIncludingThis % 10 === 0) {
      updateSummary(routeId).catch(() => {});
    }
  }
}

/** Memory layer 2. Lossy by design; CanonFact is the lossless layer. */
export async function updateSummary(routeId: string) {
  const route = await db.route.findUnique({
    where: { id: routeId },
    include: { memory: true, messages: { where: { isDeleted: false }, orderBy: { idx: "asc" } } },
  });
  if (!route) return;
  const from = route.memory?.summaryAtIdx ?? 0;
  const fresh = route.messages.filter((m) => m.idx > from && m.role !== "SYSTEM");
  if (!fresh.length) return;
  const summary = await llm().complete(
    "summary",
    buildSummaryMessages(route.memory?.summary ?? "", fresh)
  );
  const lastIdx = route.messages[route.messages.length - 1]?.idx ?? 0;
  await db.routeMemory.upsert({
    where: { routeId },
    update: { summary: summary.slice(0, 2000), summaryAtIdx: lastIdx },
    create: { routeId, summary: summary.slice(0, 2000), summaryAtIdx: lastIdx },
  });
}

/** AIF-006: "Previously on..." */
export async function refreshRecap(user: User, routeId: string) {
  const route = await getRoute(user, routeId);
  const lastIdx = route.messages[route.messages.length - 1]?.idx ?? 0;
  try {
    const recap = await llm().complete(
      "recap",
      buildRecapMessages(route.memory?.summary ?? "", route.messages.slice(-6))
    );
    await db.route.update({
      where: { id: routeId },
      data: { lastRecap: recap.slice(0, 240), lastRecapAtIdx: lastIdx },
    });
    return { lastRecap: recap.slice(0, 240) };
  } catch {
    // Fallback: the opening of the last thing that happened is still a recap.
    const fallback = route.messages[route.messages.length - 1]?.content.slice(0, 120) ?? "";
    await db.route.update({
      where: { id: routeId },
      data: { lastRecap: fallback, lastRecapAtIdx: lastIdx },
    });
    return { lastRecap: fallback };
  }
}

export async function rewindRoute(user: User, routeId: string, toIdx: number) {
  await getRoute(user, routeId);
  const result = await db.routeMessage.updateMany({
    where: { routeId, idx: { gt: toIdx } },
    data: { isDeleted: true },
  });
  // Facts settled after the rewind point are no longer true of this route.
  await db.canonFact.updateMany({
    where: { routeId, sourceTurn: { gt: toIdx }, source: "AI_EXTRACTED" },
    data: { isActive: false },
  });
  return { deletedCount: result.count };
}

export async function migrateGuestRoute(
  user: User,
  guest: {
    storyId: string;
    introId: string;
    messages: { role: "USER" | "AI"; content: string }[];
  }
) {
  const route = await createRoute(user, guest.storyId, guest.introId);
  const startIdx = route.messages.length ? route.messages[route.messages.length - 1].idx + 1 : 0;
  await db.routeMessage.createMany({
    data: guest.messages.slice(0, 20).map((m, i) => ({
      routeId: route.id,
      idx: startIdx + i,
      role: m.role,
      content: m.content.slice(0, 4000),
    })),
  });
  return db.route.findUniqueOrThrow({ where: { id: route.id } });
}

/** Signed-out trial (SCR-005/006). Nothing is persisted. */
export async function* guestTurn(
  storyId: string,
  introId: string,
  history: { role: "USER" | "AI"; content: string }[],
  content: string
): AsyncGenerator<SseEvent> {
  if (history.length > 6)
    throw new HttpError(409, "guest_limit", "Create an account to keep this route.");
  if (detectCrisis(content)) {
    yield { event: "crisis", data: CRISIS_RESOURCES };
    return;
  }
  const story = await db.story.findUnique({
    where: { id: storyId },
    include: { characters: { orderBy: { sortOrder: "asc" } }, intros: true },
  });
  if (!story || story.status !== "PUBLISHED" || story.contentLevel !== "ALL_AGES")
    throw new HttpError(404, "not_found");
  const intro = story.intros.find((i) => i.id === introId);
  if (!intro) throw new HttpError(422, "invalid_intro");

  const messages = buildChatMessages({
    story,
    intro,
    memory: null,
    canon: [],
    stats: [],
    keywords: [],
    persona: null,
    recentMessages: history.map((m) => ({ role: m.role, content: m.content })),
    rating: "ALL_AGES",
    userInput: content,
  });

  let full = "";
  for await (const chunk of llm().stream("chat", messages, {})) {
    if (chunk.type === "token" && chunk.token) {
      full += chunk.token;
      yield { event: "token", data: chunk.token };
    } else if (chunk.type === "blocked") {
      yield {
        event: "blocked",
        data: {
          message:
            "That turn crosses a line we hold, so the story didn't take it. Try steering somewhere else.",
        },
      };
      return;
    } else if (chunk.type === "done") {
      full = chunk.content ?? full;
    }
  }
  yield {
    event: "done",
    data: { message: { idx: history.length + 1, content: full, choices: null, tier: "STANDARD" } },
  };
}
