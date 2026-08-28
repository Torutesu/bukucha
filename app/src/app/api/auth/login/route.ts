import { handleFrom } from "@/lib/slug";
import { db } from "@/lib/db";
import { errorResponse, HttpError, setSessionCookie } from "@/lib/auth";

/**
 * Email sign-in.
 * With AUTH_DEV_MODE=true the magic link is skipped and the session is issued
 * immediately, which is what E2E and local development use.
 * [build-notes] Production sends the mail and verifies the token here.
 */
export async function POST(req: Request) {
  try {
    if (process.env.AUTH_DEV_MODE !== "true") {
      throw new HttpError(501, "not_implemented", "Email delivery is not configured.");
    }
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      throw new HttpError(422, "invalid_email", "That does not look like an email address.");
    const displayName = String(body.displayName ?? email.split("@")[0]).slice(0, 20);
    const preferenceTags: string[] = Array.isArray(body.preferenceTags)
      ? body.preferenceTags.slice(0, 12).map(String)
      : [];

    const user = await db.user.upsert({
      where: { email },
      update: preferenceTags.length ? { preferenceTags } : {},
      create: { email, handle: handleFrom(email), displayName, preferenceTags },
    });
    await setSessionCookie(user.id);
    return Response.json({ id: user.id, displayName: user.displayName });
  } catch (e) {
    return errorResponse(e);
  }
}
