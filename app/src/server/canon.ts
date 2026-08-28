import { db } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import { llm } from "@/lib/llm";
import { buildStateUpdateMessages } from "@/lib/prompt";
import type { CanonCategory, CanonFact, KeywordEntry, StatDef } from "@prisma/client";

/**
 * The Canon ledger — SCR-024 / AIF-001.
 *
 * The benchmark advertises "Deep Memory" and 23% of its negative reviews are
 * about the model forgetting; worse, re-teaching it costs the reader credits.
 * So memory here is an append-only ledger of settled facts that the reader owns
 * and can edit for free, rather than a lossy summary the model rewrites.
 */

const MAX_INJECTED = 40;
const CATEGORIES: CanonCategory[] = [
  "PERSON",
  "RELATIONSHIP",
  "PROMISE",
  "WORLD",
  "EVENT",
  "TRAIT",
];

/**
 * Choose which facts go into this turn's context.
 * Pinned facts always go in. The rest are ranked by whether their subject or
 * wording appears in what just happened, then by recency.
 */
export function selectCanon(facts: CanonFact[], recentText: string, limit = MAX_INJECTED) {
  const hay = recentText.toLowerCase();
  const scored = facts
    .filter((f) => f.isActive)
    .map((f) => {
      let score = 0;
      if (f.pinned) score += 1000;
      if (f.subject && hay.includes(f.subject.toLowerCase())) score += 50;
      const words = f.statement
        .toLowerCase()
        .split(/[^a-z0-9']+/)
        .filter((w) => w.length > 4);
      score += words.filter((w) => hay.includes(w)).length * 3;
      score += Math.min(20, f.sourceTurn / 5);
      return { f, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.f);
}

/** Keyword-book entries whose trigger words appear in the recent text. */
export function matchKeywords(entries: KeywordEntry[], recentText: string, introId: string) {
  const hay = recentText.toLowerCase();
  return entries.filter(
    (e) =>
      (e.introId === null || e.introId === introId) &&
      e.keywords.some((k) => k.trim() && hay.includes(k.toLowerCase()))
  );
}

interface StateUpdate {
  canon: { category?: string; subject?: string; statement?: string }[];
  stats: { key?: string; delta?: number; reason?: string }[];
}

function parseStateUpdate(raw: string): StateUpdate {
  const cleaned = raw.replace(/^```json?\s*|```\s*$/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    canon: Array.isArray(parsed.canon) ? parsed.canon : [],
    stats: Array.isArray(parsed.stats) ? parsed.stats : [],
  };
}

/**
 * Runs after a turn is already delivered. Never blocks the reader, never
 * charges them, and a failure here costs nothing but this turn's bookkeeping.
 */
export async function applyStateUpdate(
  routeId: string,
  messageId: string,
  turnIdx: number,
  turn: { user: string; ai: string }
): Promise<void> {
  const route = await db.route.findUnique({
    where: { id: routeId },
    include: {
      canon: { where: { isActive: true }, orderBy: { createdAt: "desc" }, take: 60 },
      intro: { include: { stats: true } },
      stats: true,
    },
  });
  if (!route) return;

  const statDefs: StatDef[] = route.intro.stats;
  let update: StateUpdate;
  try {
    const raw = await llm().complete(
      "state",
      buildStateUpdateMessages(
        statDefs,
        route.canon.map((c) => ({ subject: c.subject, statement: c.statement })),
        turn
      ),
      { json: true }
    );
    update = parseStateUpdate(raw);
  } catch {
    return; // AIF-001 fallback: the ledger simply does not grow this turn.
  }

  const known = new Set(route.canon.map((c) => c.statement.toLowerCase().trim()));
  const newFacts = update.canon
    .filter((c) => c.statement && c.statement.trim().length > 3)
    .filter((c) => !known.has(c.statement!.toLowerCase().trim()))
    .slice(0, 3)
    .map((c) => ({
      routeId,
      category: (CATEGORIES.includes(c.category as CanonCategory)
        ? c.category
        : "EVENT") as CanonCategory,
      subject: (c.subject ?? "").slice(0, 80),
      statement: c.statement!.slice(0, 400),
      sourceTurn: turnIdx,
    }));

  const byKey = new Map(statDefs.map((d) => [d.key, d]));
  const deltas = update.stats
    .filter((s) => s.key && byKey.has(s.key) && Number.isFinite(s.delta) && s.delta !== 0)
    .slice(0, statDefs.length)
    .map((s) => ({ def: byKey.get(s.key!)!, delta: Math.trunc(s.delta!), reason: (s.reason ?? "").slice(0, 80) }));

  await db.$transaction(async (tx) => {
    if (newFacts.length) await tx.canonFact.createMany({ data: newFacts });
    for (const d of deltas) {
      const current = route.stats.find((v) => v.statDefId === d.def.id)?.value ?? d.def.initialValue;
      const next = Math.max(d.def.minValue, Math.min(d.def.maxValue, current + d.delta));
      if (next === current) continue;
      await tx.statValue.upsert({
        where: { routeId_statDefId: { routeId, statDefId: d.def.id } },
        update: { value: next },
        create: { routeId, statDefId: d.def.id, value: next },
      });
      await tx.statDelta.create({
        data: { messageId, statDefId: d.def.id, delta: next - current, reason: d.reason },
      });
    }
  });
}

// ============ Reader-facing CRUD (SCR-024). Never metered. ============

async function ownedRoute(userId: string, routeId: string) {
  const r = await db.route.findUnique({ where: { id: routeId }, select: { userId: true } });
  if (!r || r.userId !== userId) throw new HttpError(404, "not_found");
}

export async function listCanon(userId: string, routeId: string) {
  await ownedRoute(userId, routeId);
  return db.canonFact.findMany({
    where: { routeId, isActive: true },
    orderBy: [{ pinned: "desc" }, { sourceTurn: "asc" }],
  });
}

export async function addCanon(
  userId: string,
  routeId: string,
  data: { category: CanonCategory; subject: string; statement: string }
) {
  await ownedRoute(userId, routeId);
  if (!data.statement.trim()) throw new HttpError(422, "statement_required", "Write what is true.");
  return db.canonFact.create({
    data: {
      routeId,
      category: CATEGORIES.includes(data.category) ? data.category : "EVENT",
      subject: data.subject.slice(0, 80),
      statement: data.statement.slice(0, 400),
      source: "USER_ADDED",
      pinned: true,
    },
  });
}

export async function updateCanon(
  userId: string,
  routeId: string,
  factId: string,
  data: { statement?: string; subject?: string; pinned?: boolean; isActive?: boolean }
) {
  await ownedRoute(userId, routeId);
  const fact = await db.canonFact.findUnique({ where: { id: factId } });
  if (!fact || fact.routeId !== routeId) throw new HttpError(404, "not_found");
  return db.canonFact.update({
    where: { id: factId },
    data: {
      ...(data.statement !== undefined ? { statement: data.statement.slice(0, 400) } : {}),
      ...(data.subject !== undefined ? { subject: data.subject.slice(0, 80) } : {}),
      ...(data.pinned !== undefined ? { pinned: data.pinned } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      source: data.statement !== undefined || data.subject !== undefined ? "USER_EDITED" : fact.source,
    },
  });
}
