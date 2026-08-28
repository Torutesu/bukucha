import { db } from "./db";
import { HttpError } from "./auth";

/**
 * Fair-use ceiling, not a paywall.
 *
 * Standard turns are unlimited on every plan, so this exists only to stop
 * automated abuse — it sits far above what a person reads in an hour. The
 * message it produces has to read like a pause, never like a bill.
 */

export async function assertMessageQuota(user: { id: string; email: string | null }) {
  const userId = user.id;
  // E2E-017 pins the ceiling to 3 for fixture users named ratelimit*.
  const limit =
    process.env.E2E_MODE === "1" && user.email?.startsWith("ratelimit")
      ? 3
      : Number(process.env.MESSAGE_RATE_LIMIT ?? 60);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await db.routeMessage.count({
    where: {
      role: "USER",
      createdAt: { gte: since },
      route: { userId },
    },
  });
  if (count >= limit) {
    throw new HttpError(
      429,
      "quota_exceeded",
      "You are reading faster than we can keep up with. Give it a moment and continue."
    );
  }
}

/** Signed-out trial, per IP, in memory. Abuse guard only (SCR-005). */
const guestCounts = new Map<string, { count: number; reset: number }>();

export function assertGuestQuota(ip: string) {
  const limit = Number(process.env.GUEST_TURN_LIMIT ?? 30);
  const now = Date.now();
  const entry = guestCounts.get(ip);
  if (!entry || now > entry.reset) {
    guestCounts.set(ip, { count: 1, reset: now + 60 * 60 * 1000 });
    return;
  }
  if (entry.count >= limit) {
    throw new HttpError(429, "guest_quota", "That is the end of the preview. Sign in to keep going.");
  }
  entry.count++;
}
