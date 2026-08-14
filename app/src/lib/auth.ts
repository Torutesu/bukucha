import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import type { User } from "@prisma/client";

/**
 * 最小の署名Cookieセッション。
 * [build-notes] Auth.js(Google/Apple OAuth)はP1で導入。MVPはメールログイン(開発モードでは
 * magic link送信を省略して即ログイン)のみ。SCR-017のOAuthボタンはenv未設定時disabled。
 */

const COOKIE = "bukucha_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret(): string {
  return process.env.AUTH_SECRET ?? "dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function makeSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + MAX_AGE * 1000 })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.uid !== "string" || Date.now() > data.exp) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const store = await cookies();
  store.set(COOKIE, makeSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const uid = verifySessionToken(token);
  if (!uid) return null;
  return db.user.findUnique({ where: { id: uid } });
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "unauthorized", "ログインが必要です");
  if (user.status === "BANNED")
    throw new HttpError(403, "banned", "このアカウントは利用停止されています");
  return user;
}

/** 管理API/画面の認可。判定はサーバー側のみ(プロダクト原則7) */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new HttpError(403, "forbidden", "権限がありません");
  return user;
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json(
      { error: { code: e.code, message: e.message } },
      { status: e.status }
    );
  }
  console.error(e);
  return Response.json(
    { error: { code: "internal", message: "エラーが発生しました" } },
    { status: 500 }
  );
}
