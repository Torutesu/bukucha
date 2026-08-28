import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError, clearSessionCookie } from "@/lib/auth";
import { isAdult } from "@/lib/policy";
import { PLANS, quotaState } from "@/lib/quota";

export async function GET() {
  try {
    const user = await requireUser();
    const personas = await db.persona.findMany({ where: { userId: user.id } });
    return Response.json({
      ...user,
      personas,
      isAdult: isAdult(user),
      quota: quotaState(user),
      plans: Object.values(PLANS),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof b.displayName === "string" && b.displayName.trim())
      data.displayName = b.displayName.trim().slice(0, 20);
    if (typeof b.avatarUrl === "string" || b.avatarUrl === null) data.avatarUrl = b.avatarUrl;
    if (Array.isArray(b.preferenceTags))
      data.preferenceTags = b.preferenceTags.slice(0, 12).map(String);

    if (b.birthDate !== undefined) {
      // Set once. Letting it change would defeat the age gate (SCR-018).
      if (user.birthDate) throw new HttpError(422, "birthdate_locked", "Your date of birth cannot be changed.");
      const d = new Date(String(b.birthDate));
      if (isNaN(d.getTime()) || d > new Date())
        throw new HttpError(422, "invalid_birthdate", "That date does not look right.");
      data.birthDate = d;
    }

    if (b.matureOptIn !== undefined) {
      const nextBirth = (data.birthDate as Date | undefined) ?? user.birthDate;
      if (b.matureOptIn === true && !isAdult({ birthDate: nextBirth ?? null })) {
        // Invariant #1, enforced server-side and never trusted from the client.
        throw new HttpError(403, "age_restricted", "Mature stories unlock at 18.");
      }
      data.matureOptIn = Boolean(b.matureOptIn);
    }

    const updated = await db.user.update({ where: { id: user.id }, data });
    return Response.json({ ...updated, isAdult: isAdult(updated) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    // Deletion unpublishes their work and anonymises the account. Unlike the
    // benchmark, a leftover credit balance is not forfeited on the way out.
    await db.$transaction([
      db.story.updateMany({ where: { authorId: user.id }, data: { status: "SUSPENDED" } }),
      db.user.update({
        where: { id: user.id },
        data: { email: null, displayName: "Deleted reader", avatarUrl: null },
      }),
    ]);
    await clearSessionCookie();
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
