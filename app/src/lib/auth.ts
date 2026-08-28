import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import type { User } from "@prisma/client";

/**
 * Minimal signed-cookie session.
 * [build-notes] Auth.js with Google and Apple lands in P1 — the benchmark ships
 * exactly those two providers. Email sign-in is what the MVP exercises; the
 * OAuth buttons on SCR-017 stay disabled until the env is configured.
 */

const COOKIE = "hc_session";
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
  if (!user) throw new HttpError(401, "unauthorized", "Sign in to continue.");
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
    { error: { code: "internal", message: "Something went wrong on our end." } },
    { status: 500 }
  );
}
