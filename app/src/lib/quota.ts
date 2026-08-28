import type { Plan, User } from "@prisma/client";

/**
 * Plan and quota rules — teardown §6.
 *
 * The benchmark meters every generation and sells no subscription; 69% of its
 * negative reviews are about that. So the core reading loop is deliberately
 * outside the meter here: STANDARD generations are unlimited on every plan,
 * including free. Only the CINEMATIC tier is counted.
 */

export type ModelTier = "STANDARD" | "CINEMATIC";

export interface PlanSpec {
  id: Plan;
  name: string;
  priceCents: number;
  webPriceCents: number;
  /** CINEMATIC generations per quota window. */
  cinematic: number;
  /** Length of the quota window in hours. Free resets daily; paid, monthly. */
  windowHours: number;
  blurb: string;
  perks: string[];
}

export const PLANS: Record<Plan, PlanSpec> = {
  FREE: {
    id: "FREE",
    name: "Free",
    priceCents: 0,
    webPriceCents: 0,
    cinematic: 3,
    windowHours: 24,
    blurb: "Read forever. No meter on the story itself.",
    perks: [
      "Unlimited turns on the Standard narrator",
      "3 Cinematic turns a day",
      "Canon memory, always free to edit",
      "No ads, ever",
    ],
  },
  READER: {
    id: "READER",
    name: "Reader",
    priceCents: 999,
    webPriceCents: 799,
    cinematic: 600,
    windowHours: 24 * 30,
    blurb: "For the reader who finishes what they start.",
    perks: [
      "Everything in Free",
      "600 Cinematic turns a month",
      "Unlimited saved routes",
      "Scene images",
      "Early access to new stories",
    ],
  },
  AUTHOR: {
    id: "AUTHOR",
    name: "Author",
    priceCents: 1999,
    webPriceCents: 1599,
    cinematic: 2000,
    windowHours: 24 * 30,
    blurb: "For the reader who became a writer.",
    perks: [
      "Everything in Reader",
      "2,000 Cinematic turns a month",
      "Unlimited AI drafting in the builder",
      "Full earnings dashboard",
      "Priority review on publish",
    ],
  },
};

export interface QuotaState {
  plan: Plan;
  tier: ModelTier;
  cinematicUsed: number;
  cinematicLimit: number;
  cinematicLeft: number;
  resetsAt: Date;
}

function windowEnd(user: Pick<User, "plan" | "cinematicWindowAt">): Date {
  const spec = PLANS[user.plan];
  return new Date(user.cinematicWindowAt.getTime() + spec.windowHours * 3600_000);
}

export function quotaState(
  user: Pick<User, "plan" | "cinematicUsed" | "cinematicWindowAt">,
  now: Date = new Date()
): QuotaState {
  const spec = PLANS[user.plan];
  const expired = now >= windowEnd(user);
  const used = expired ? 0 : user.cinematicUsed;
  return {
    plan: user.plan,
    tier: "STANDARD",
    cinematicUsed: used,
    cinematicLimit: spec.cinematic,
    cinematicLeft: Math.max(0, spec.cinematic - used),
    resetsAt: expired ? new Date(now.getTime() + spec.windowHours * 3600_000) : windowEnd(user),
  };
}

/**
 * STANDARD is always allowed. CINEMATIC falls back to STANDARD rather than
 * blocking — the story never stops because of a plan, it only gets plainer.
 */
export function resolveTier(
  requested: ModelTier,
  user: Pick<User, "plan" | "cinematicUsed" | "cinematicWindowAt">,
  now: Date = new Date()
): { tier: ModelTier; downgraded: boolean; quota: QuotaState } {
  const quota = quotaState(user, now);
  if (requested === "STANDARD") return { tier: "STANDARD", downgraded: false, quota };
  if (quota.cinematicLeft > 0) return { tier: "CINEMATIC", downgraded: false, quota };
  return { tier: "STANDARD", downgraded: true, quota };
}
