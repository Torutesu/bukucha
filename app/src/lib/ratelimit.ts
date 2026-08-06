import { db } from "./db";
import { HttpError } from "./auth";

/**
 * 無料枠レート制限(03-api.md [ASSUMED])。
 * MVPは課金なし＝ここが将来の課金トリガー地点(E2E-017)。
 * 上限はenvで調整可能(E2Eでは3に設定)。
 */

export async function assertMessageQuota(user: { id: string; email: string | null }) {
  const userId = user.id;
  // E2E-017: E2Eモードでは ratelimit* ユーザーの上限を3に固定
  const limit =
    process.env.E2E_MODE === "1" && user.email?.startsWith("ratelimit")
      ? 3
      : Number(process.env.MESSAGE_RATE_LIMIT ?? 60);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await db.storyMessage.count({
    where: {
      role: "USER",
      createdAt: { gte: since },
      story: { userId },
    },
  });
  if (count >= limit) {
    throw new HttpError(
      429,
      "quota_exceeded",
      "今日はここまで。また明日つづきを読めます"
    );
  }
}

/** ゲスト体験(IPベース・メモリ内)。3往復まで(SCR-005) */
const guestCounts = new Map<string, { count: number; reset: number }>();

export function assertGuestQuota(ip: string) {
  const limit = Number(process.env.GUEST_TURN_LIMIT ?? 30); // IP単位の乱用防止
  const now = Date.now();
  const entry = guestCounts.get(ip);
  if (!entry || now > entry.reset) {
    guestCounts.set(ip, { count: 1, reset: now + 60 * 60 * 1000 });
    return;
  }
  if (entry.count >= limit) {
    throw new HttpError(429, "guest_quota", "体験回数の上限に達しました");
  }
  entry.count++;
}
