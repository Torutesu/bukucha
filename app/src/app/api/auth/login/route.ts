import { db } from "@/lib/db";
import { errorResponse, HttpError, setSessionCookie } from "@/lib/auth";

/**
 * メールログイン。
 * AUTH_DEV_MODE=true では magic link送信を省略して即ログイン(E2E/開発用)。
 * [build-notes] 本番はメール送信+トークン検証をここに実装する。
 */
export async function POST(req: Request) {
  try {
    if (process.env.AUTH_DEV_MODE !== "true") {
      throw new HttpError(501, "not_implemented", "メール送信は未設定です");
    }
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      throw new HttpError(422, "invalid_email", "メールアドレスの形式が不正です");
    const nickname = String(body.nickname ?? email.split("@")[0]).slice(0, 20);
    const preferenceTags: string[] = Array.isArray(body.preferenceTags)
      ? body.preferenceTags.slice(0, 12).map(String)
      : [];

    const user = await db.user.upsert({
      where: { email },
      update: preferenceTags.length ? { preferenceTags } : {},
      create: { email, nickname, preferenceTags },
    });
    if (user.status === "BANNED")
      throw new HttpError(403, "banned", "このアカウントは利用停止されています");
    await setSessionCookie(user.id);
    return Response.json({ id: user.id, nickname: user.nickname });
  } catch (e) {
    return errorResponse(e);
  }
}
