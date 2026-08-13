import { db } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { llm } from "@/lib/llm";
import {
  buildChatMessages,
  buildRecapMessages,
  buildSuggestMessages,
  buildSummaryMessages,
} from "@/lib/prompt";
import { expressionProfile, visibleLevels } from "@/lib/policy";
import type { SseEvent } from "./sse";
import type { User } from "@prisma/client";

const RECENT_TURNS = 40; // 直近20往復

export async function createStory(
  user: User,
  situationId: string,
  introVariantId: string,
  personaId?: string
) {
  const situation = await db.situation.findUnique({
    where: { id: situationId },
    include: { intros: true },
  });
  if (!situation) throw new HttpError(404, "not_found");
  const isOwner = situation.authorId === user.id;
  if (!isOwner) {
    if (situation.status !== "PUBLISHED") throw new HttpError(404, "not_found");
    if (!visibleLevels(user).includes(situation.contentLevel))
      throw new HttpError(404, "not_visible", "この物語は表示できません");
  }
  const intro = situation.intros.find((i) => i.id === introVariantId);
  if (!intro) throw new HttpError(422, "invalid_intro");

  const persona =
    personaId ??
    (await db.persona.findFirst({ where: { userId: user.id, isDefault: true } }))?.id;

  const firstRead = !(await db.story.findFirst({
    where: { userId: user.id, situationId },
  }));

  const story = await db.$transaction(async (tx) => {
    const st = await tx.story.create({
      data: {
        userId: user.id,
        situationId,
        introVariantId,
        personaId: persona ?? null,
        memory: { create: {} },
        messages: {
          create: [
            { idx: 0, role: "SYSTEM", content: intro.introText },
            { idx: 1, role: "AI", content: intro.firstMessage },
          ],
        },
      },
    });
    await tx.situation.update({
      where: { id: situationId },
      data: {
        storyCount: { increment: 1 },
        ...(firstRead ? { readerCount: { increment: 1 } } : {}),
      },
    });
    return st;
  });
  return getStory(user, story.id);
}

export async function getStory(user: User, id: string) {
  const story = await db.story.findUnique({
    where: { id },
    include: {
      situation: { include: { characters: { orderBy: { sortOrder: "asc" } } } },
      introVariant: true,
      persona: true,
      memory: true,
      messages: { where: { isDeleted: false }, orderBy: { idx: "asc" } },
    },
  });
  if (!story || story.userId !== user.id) throw new HttpError(404, "not_found");
  return story;
}

export async function listStories(
  user: User,
  status: "ACTIVE" | "ARCHIVED",
  situationId?: string
) {
  return db.story.findMany({
    where: { userId: user.id, status, ...(situationId ? { situationId } : {}) },
    include: {
      situation: { select: { id: true, title: true, coverImageUrl: true } },
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
 * AIF-001+005+007: 1往復の生成(SSE)。
 * rerollIdx指定時は該当AI応答を差し替え(AIF-001 リロール)。
 */
const USER_KINDS = ["SAY", "ACTION", "DIRECTION"] as const;
type UserKind = (typeof USER_KINDS)[number];

export function normalizeKind(kind: unknown): UserKind {
  return USER_KINDS.includes(kind as UserKind) ? (kind as UserKind) : "SAY";
}

export async function* storyTurn(
  user: User,
  storyId: string,
  input: {
    content: string;
    selectedChoiceId?: string;
    instruction?: string;
    rerollIdx?: number;
    kind?: string;
  }
): AsyncGenerator<SseEvent> {
  const story = await getStory(user, storyId);
  const live = story.messages;

  let userInput = input.content;
  let userKind: UserKind = normalizeKind(input.kind);
  let historyEnd = live.length;
  let rerollTarget: number | null = null;

  if (input.rerollIdx !== undefined) {
    const target = live.find((m) => m.idx === input.rerollIdx && m.role === "AI");
    if (!target) throw new HttpError(422, "invalid_reroll");
    rerollTarget = target.idx;
    historyEnd = live.findIndex((m) => m.idx === target.idx);
    const prevUser = [...live.slice(0, historyEnd)].reverse().find((m) => m.role === "USER");
    userInput = prevUser?.content ?? "";
    userKind = normalizeKind(prevUser?.kind);
  }

  const recent = live
    .slice(Math.max(0, historyEnd - RECENT_TURNS), historyEnd)
    .filter((m) => m.role !== "SYSTEM");

  const expression = expressionProfile(story.situation.contentLevel, user);
  const messages = buildChatMessages({
    situation: story.situation,
    intro: story.introVariant,
    memory: story.memory,
    persona: story.persona,
    recentMessages: recent,
    expression,
    userInput,
    userKind,
  });

  // AIF-005: 選択肢はユーザーの2ターンに1回(この往復を含めて偶数ターン目に提示)。
  // Story.choicesEnabled=false なら常に付けない(Zetaの選択肢ON/OFF切替)
  const userTurnsIncludingThis = live.filter((m) => m.role === "USER").length + 1;
  const wantChoices =
    story.choicesEnabled && rerollTarget === null && userTurnsIncludingThis % 2 === 0;
  const tier = story.useMidModel ? ("mid" as const) : ("light" as const);

  const timeoutMs = Number(process.env.GENERATION_TIMEOUT_MS ?? 20_000);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  let full = "";
  let choices: { id: string; text: string }[] | null = null;
  let debug: Record<string, unknown> | undefined;

  try {
    const gen = llm().stream("chat", messages, {
      wantChoices,
      tier,
      instruction: input.instruction,
      signal: abort.signal,
    });
    for await (const chunk of gen) {
      if (chunk.type === "token" && chunk.token) {
        full += chunk.token;
        yield { event: "token", data: chunk.token };
      } else if (chunk.type === "blocked") {
        // AIF-007: 確定させず入力を捨てる
        yield {
          event: "blocked",
          data: {
            message:
              "この展開は表現ガイドラインに触れるため書けませんでした。別の展開を試してください",
          },
        };
        await db.moderationFlag.create({
          data: {
            targetType: "message",
            targetId: storyId,
            kind: "CONTENT_OVER_LINE",
            detail: `blocked input on story ${storyId}`,
          },
        });
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

  // 永続化
  const saved = await db.$transaction(async (tx) => {
    if (rerollTarget !== null) {
      const msg = await tx.storyMessage.update({
        where: { storyId_idx: { storyId, idx: rerollTarget } },
        data: { content: full, choices: choices ?? undefined, modelUsed: `${process.env.LLM_PROVIDER ?? "openai"}:${tier}` },
      });
      return msg;
    }
    const lastIdx = live.length ? live[live.length - 1].idx : -1;
    // 論理削除済みidxとの衝突を避ける
    const maxIdx = await tx.storyMessage.aggregate({
      where: { storyId },
      _max: { idx: true },
    });
    const base = Math.max(lastIdx, maxIdx._max.idx ?? -1);
    if (userInput.trim() || input.selectedChoiceId) {
      await tx.storyMessage.create({
        data: {
          storyId,
          idx: base + 1,
          role: "USER",
          kind: userKind,
          content: userInput,
          selectedChoice: input.selectedChoiceId ?? null,
        },
      });
    }
    const ai = await tx.storyMessage.create({
      data: {
        storyId,
        idx: base + (userInput.trim() || input.selectedChoiceId ? 2 : 1),
        role: "AI",
        content: full,
        choices: choices ?? undefined,
        modelUsed: `${process.env.LLM_PROVIDER ?? "openai"}:${tier}`,
      },
    });
    await tx.story.update({ where: { id: storyId }, data: { lastMessageAt: new Date() } });
    return ai;
  });

  yield {
    event: "done",
    data: {
      message: { idx: saved.idx, content: full, choices },
      ...(process.env.LLM_PROVIDER === "mock" ? { debug } : {}),
    },
  };

  // AIF-003: 10往復ごとに要約更新(非同期・失敗許容)
  const totalUser = live.filter((m) => m.role === "USER").length + 1;
  if (totalUser % 10 === 0) {
    updateSummary(storyId).catch(() => {});
  }
}

/** AIF-003 */
export async function updateSummary(storyId: string) {
  const story = await db.story.findUnique({
    where: { id: storyId },
    include: {
      memory: true,
      messages: { where: { isDeleted: false }, orderBy: { idx: "asc" } },
    },
  });
  if (!story) return;
  const from = story.memory?.summaryAtIdx ?? 0;
  const fresh = story.messages.filter((m) => m.idx > from && m.role !== "SYSTEM");
  if (!fresh.length) return;
  const summary = await llm().complete(
    "summary",
    buildSummaryMessages(story.memory?.summary ?? "", fresh)
  );
  const lastIdx = story.messages[story.messages.length - 1]?.idx ?? 0;
  await db.storyMemory.upsert({
    where: { storyId },
    update: { summary: summary.slice(0, 2000), summaryAtIdx: lastIdx },
    create: { storyId, summary: summary.slice(0, 2000), summaryAtIdx: lastIdx },
  });
}

/** AIF-004 */
export async function refreshRecap(user: User, storyId: string) {
  const story = await getStory(user, storyId);
  const lastIdx = story.messages[story.messages.length - 1]?.idx ?? 0;
  try {
    const recap = await llm().complete(
      "recap",
      buildRecapMessages(story.memory?.summary ?? "", story.messages.slice(-6))
    );
    await db.story.update({
      where: { id: storyId },
      data: { lastRecap: recap.slice(0, 200), lastRecapAtIdx: lastIdx },
    });
    return { lastRecap: recap.slice(0, 200) };
  } catch {
    // fallback: 最終メッセージ冒頭
    const fallback = story.messages[story.messages.length - 1]?.content.slice(0, 80) ?? "";
    await db.story.update({
      where: { id: storyId },
      data: { lastRecap: fallback, lastRecapAtIdx: lastIdx },
    });
    return { lastRecap: fallback };
  }
}

/**
 * AIF-008: 返信候補(ユーザー側セリフの代筆)。
 * 1日50回・朝9時JSTリセット(=UTC 0時。dateKeyはUTC日付)。E2Eでは suggestlimit* ユーザーの上限を2に固定
 */
export async function suggestReplies(user: User, storyId: string) {
  const story = await getStory(user, storyId);
  const limit =
    process.env.E2E_MODE === "1" && user.email?.startsWith("suggestlimit")
      ? 2
      : Number(process.env.SUGGEST_DAILY_LIMIT ?? 50);
  const dateKey = new Date().toISOString().slice(0, 10);
  const fresh = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { suggestDate: true, suggestUsed: true },
  });
  const used = fresh.suggestDate === dateKey ? fresh.suggestUsed : 0;
  if (used >= limit) {
    throw new HttpError(
      429,
      "suggest_quota",
      "今日の返信候補はここまで。あす朝9時にまた使えます"
    );
  }

  const recent = story.messages
    .filter((m) => m.role !== "SYSTEM")
    .slice(-RECENT_TURNS);
  const raw = await llm().complete(
    "suggest",
    buildSuggestMessages({
      situation: story.situation,
      intro: story.introVariant,
      memory: story.memory,
      persona: story.persona,
      recentMessages: recent,
      expression: expressionProfile(story.situation.contentLevel, user),
    }),
    { json: true }
  );
  let suggestions: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.suggestions)) {
      suggestions = parsed.suggestions
        .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
        .slice(0, 2);
    }
  } catch {
    /* fall through */
  }
  if (!suggestions.length) throw new HttpError(502, "suggest_failed", "候補を作れませんでした");

  await db.user.update({
    where: { id: user.id },
    data: { suggestDate: dateKey, suggestUsed: used + 1 },
  });
  return { suggestions, remaining: limit - used - 1 };
}

/** AI応答のペン編集(Zeta: AI返信のみ直接編集可) */
export async function editMessage(user: User, storyId: string, idx: number, content: string) {
  await getStory(user, storyId);
  const body = content.trim();
  if (!body || body.length > 4000) throw new HttpError(422, "invalid_content");
  const target = await db.storyMessage.findUnique({
    where: { storyId_idx: { storyId, idx } },
  });
  if (!target || target.isDeleted || target.role !== "AI")
    throw new HttpError(422, "invalid_target", "AIの応答のみ編集できます");
  return db.storyMessage.update({
    where: { storyId_idx: { storyId, idx } },
    data: { content: body },
  });
}

/**
 * ここから分岐(並行ルート)。atIdxまでのメッセージを新しいStoryへ複製する。
 * Zetaの「キャラ毎に複数セッション=並行世界」+ USER-REQ「自分で物語の分岐を作れる」
 */
export async function branchStory(user: User, storyId: string, atIdx: number) {
  const src = await getStory(user, storyId);
  const copy = src.messages.filter((m) => m.idx <= atIdx);
  if (!copy.length) throw new HttpError(422, "invalid_branch");
  const branched = await db.$transaction(async (tx) => {
    const st = await tx.story.create({
      data: {
        userId: user.id,
        situationId: src.situationId,
        introVariantId: src.introVariantId,
        personaId: src.personaId,
        branchedFromStoryId: src.id,
        choicesEnabled: src.choicesEnabled,
        useMidModel: src.useMidModel,
        memory: {
          create: {
            summary: src.memory?.summary ?? "",
            summaryAtIdx: Math.min(src.memory?.summaryAtIdx ?? 0, atIdx),
            userNote: src.memory?.userNote ?? "",
          },
        },
      },
    });
    await tx.storyMessage.createMany({
      data: copy.map((m) => ({
        storyId: st.id,
        idx: m.idx,
        role: m.role,
        content: m.content,
        selectedChoice: m.selectedChoice,
      })),
    });
    await tx.situation.update({
      where: { id: src.situationId },
      data: { storyCount: { increment: 1 } },
    });
    return st;
  });
  return branched;
}

export async function rewindStory(user: User, storyId: string, toIdx: number) {
  await getStory(user, storyId); // 権限確認
  const result = await db.storyMessage.updateMany({
    where: { storyId, idx: { gt: toIdx } },
    data: { isDeleted: true },
  });
  return { deletedCount: result.count };
}

export async function migrateGuestStory(
  user: User,
  guest: {
    situationId: string;
    introVariantId: string;
    messages: { role: "USER" | "AI"; content: string }[];
  }
) {
  const story = await createStory(user, guest.situationId, guest.introVariantId);
  const startIdx = story.messages.length ? story.messages[story.messages.length - 1].idx + 1 : 0;
  await db.storyMessage.createMany({
    data: guest.messages.slice(0, 20).map((m, i) => ({
      storyId: story.id,
      idx: startIdx + i,
      role: m.role,
      content: m.content.slice(0, 4000),
    })),
  });
  return db.story.findUniqueOrThrow({ where: { id: story.id } });
}

/** ゲスト体験(SCR-005/006, /api/guest/turn)。非永続 */
export async function* guestTurn(
  situationId: string,
  introVariantId: string,
  history: { role: "USER" | "AI"; content: string }[],
  content: string
): AsyncGenerator<SseEvent> {
  if (history.length > 6) throw new HttpError(409, "guest_limit", "登録して続きを読んでください");
  const situation = await db.situation.findUnique({
    where: { id: situationId },
    include: { characters: { orderBy: { sortOrder: "asc" } }, intros: true },
  });
  if (!situation || situation.status !== "PUBLISHED" || situation.contentLevel !== "ALL_AGES")
    throw new HttpError(404, "not_found");
  const intro = situation.intros.find((i) => i.id === introVariantId);
  if (!intro) throw new HttpError(422, "invalid_intro");

  const messages = buildChatMessages({
    situation,
    intro,
    memory: null,
    persona: null,
    recentMessages: history.map((m) => ({ role: m.role, content: m.content })),
    expression: "ALL_AGES",
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
            "この展開は表現ガイドラインに触れるため書けませんでした。別の展開を試してください",
        },
      };
      return;
    } else if (chunk.type === "done") {
      full = chunk.content ?? full;
    }
  }
  yield { event: "done", data: { message: { idx: history.length + 1, content: full, choices: null } } };
}
