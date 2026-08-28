import { db } from "@/lib/db";
import type { EndingDef, EndingRarity, EndingRule, StatDef } from "@prisma/client";

/**
 * Endings — SCR-022 / AIF-004.
 *
 * The benchmark checks ending conditions from turn 10 and every 5 turns after,
 * but shows the reader nothing until one fires, so reaching a rare ending feels
 * like luck. Conditions here are evaluated the same way and then surfaced as a
 * radar: you can tell you are close to something without being told what.
 */

const RARITY_ORDER: Record<EndingRarity, number> = { N: 0, R: 1, SR: 2, SSR: 3 };

export const FIRST_CHECK_TURN = 10;
export const CHECK_EVERY = 5;

export function isCheckTurn(turnCount: number): boolean {
  return turnCount >= FIRST_CHECK_TURN && (turnCount - FIRST_CHECK_TURN) % CHECK_EVERY === 0;
}

type DefWithRules = EndingDef & { rules: (EndingRule & { statDef: StatDef })[] };

function ruleMet(rule: EndingRule, value: number): boolean {
  return rule.comparator === "GTE" ? value >= rule.value : value < rule.value;
}

/** 0..1 — how close this route is to unlocking the ending. */
export function progressToward(
  def: DefWithRules,
  values: Map<string, number>,
  turnCount: number
): number {
  const turnPart = Math.min(1, turnCount / Math.max(1, def.minTurns));
  if (!def.rules.length) return turnPart;
  const rulePart =
    def.rules.reduce((acc, r) => {
      const v = values.get(r.statDefId) ?? r.statDef.initialValue;
      if (ruleMet(r, v)) return acc + 1;
      const span = Math.max(1, r.statDef.maxValue - r.statDef.minValue);
      const gap = r.comparator === "GTE" ? r.value - v : v - r.value;
      return acc + Math.max(0, 1 - gap / span);
    }, 0) / def.rules.length;
  return turnPart * 0.35 + rulePart * 0.65;
}

export interface RadarEntry {
  id: string;
  name: string | null;
  rarity: EndingRarity;
  hint: string;
  progress: number;
  reached: boolean;
}

/**
 * What the reader is allowed to see. A locked ending shows its hint and a bar,
 * never its name or its conditions.
 */
export async function endingRadar(routeId: string): Promise<RadarEntry[]> {
  const route = await db.route.findUnique({
    where: { id: routeId },
    include: {
      intro: { include: { endings: { include: { rules: { include: { statDef: true } } } } } },
      stats: true,
      messages: { where: { isDeleted: false, role: "USER" }, select: { id: true } },
      endings: { select: { endingDefId: true } },
    },
  });
  if (!route) return [];
  const values = new Map(route.stats.map((s) => [s.statDefId, s.value]));
  const turnCount = route.messages.length;
  const reached = new Set(route.endings.map((e) => e.endingDefId));
  return route.intro.endings
    .map((def) => {
      const isReached = reached.has(def.id);
      return {
        id: def.id,
        name: isReached ? def.name : null,
        rarity: def.rarity,
        hint: def.hint,
        progress: isReached ? 1 : progressToward(def, values, turnCount),
        reached: isReached,
      };
    })
    .sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);
}

export interface ReachedEnding {
  id: string;
  name: string;
  rarity: EndingRarity;
  epilogue: string;
}

/**
 * Runs after a turn is persisted. Returns the ending that fired, if any.
 * Rules are deterministic, so this costs nothing and cannot hallucinate a
 * conclusion the reader did not earn.
 */
export async function evaluateEndings(routeId: string): Promise<ReachedEnding | null> {
  const route = await db.route.findUnique({
    where: { id: routeId },
    include: {
      intro: { include: { endings: { include: { rules: { include: { statDef: true } } } } } },
      stats: true,
      messages: { where: { isDeleted: false, role: "USER" }, select: { id: true } },
      endings: { select: { endingDefId: true } },
    },
  });
  if (!route || route.status !== "ACTIVE") return null;

  const turnCount = route.messages.length;
  if (!isCheckTurn(turnCount)) return null;

  const values = new Map(route.stats.map((s) => [s.statDefId, s.value]));
  const already = new Set(route.endings.map((e) => e.endingDefId));

  const eligible = route.intro.endings
    .filter((d) => !already.has(d.id) && turnCount >= d.minTurns)
    .filter((d) =>
      d.rules.every((r) => ruleMet(r, values.get(r.statDefId) ?? r.statDef.initialValue))
    )
    // An earned ending beats a default one, and the rarest earned ending wins.
    // Without this, an unconditional ending would end every route the moment it
    // became eligible, which is not what a fallback is for.
    .sort((a, b) => {
      const earned = Number(b.rules.length > 0) - Number(a.rules.length > 0);
      return earned !== 0 ? earned : RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
    });

  const won = eligible[0];
  if (!won) return null;

  const snapshot = Object.fromEntries(
    route.stats.map((s) => [s.statDefId, s.value])
  ) as Record<string, number>;

  await db.$transaction([
    db.endingReached.create({
      data: {
        userId: route.userId,
        storyId: route.storyId,
        endingDefId: won.id,
        routeId,
        turnCount,
        statSnapshot: snapshot,
      },
    }),
    db.route.update({ where: { id: routeId }, data: { status: "ENDED" } }),
    db.story.update({ where: { id: route.storyId }, data: { endingCount: { increment: 1 } } }),
  ]);

  return { id: won.id, name: won.name, rarity: won.rarity, epilogue: won.epilogue };
}

/** SCR-022: everything this reader has collected for one story. */
export async function collectionFor(userId: string, storyId: string) {
  const [story, found] = await Promise.all([
    db.story.findUnique({
      where: { id: storyId },
      select: {
        id: true,
        title: true,
        slug: true,
        intros: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            label: true,
            endings: {
              orderBy: { sortOrder: "asc" },
              select: { id: true, name: true, rarity: true, hint: true, epilogue: true },
            },
          },
        },
      },
    }),
    db.endingReached.findMany({
      where: { userId, storyId },
      orderBy: { reachedAt: "asc" },
    }),
  ]);
  if (!story) return null;
  const byDef = new Map<string, (typeof found)[number][]>();
  for (const r of found) byDef.set(r.endingDefId, [...(byDef.get(r.endingDefId) ?? []), r]);

  const intros = story.intros.map((intro) => ({
    id: intro.id,
    label: intro.label,
    endings: intro.endings.map((e) => {
      const hits = byDef.get(e.id) ?? [];
      return {
        id: e.id,
        rarity: e.rarity,
        hint: e.hint,
        reached: hits.length > 0,
        /** Repeats stack, the way collection cards do. */
        times: hits.length,
        name: hits.length ? e.name : null,
        epilogue: hits.length ? e.epilogue : null,
        firstReachedAt: hits[0]?.reachedAt ?? null,
      };
    }),
  }));
  const total = intros.reduce((n, i) => n + i.endings.length, 0);
  const got = intros.reduce((n, i) => n + i.endings.filter((e) => e.reached).length, 0);
  return { story: { id: story.id, title: story.title, slug: story.slug }, intros, total, got };
}
