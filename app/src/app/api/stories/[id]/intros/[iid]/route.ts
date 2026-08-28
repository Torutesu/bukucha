import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { requireOwnedStory } from "@/server/stories";

type Params = { params: Promise<{ id: string; iid: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id, iid } = await params;
    const user = await requireUser();
    const s = await requireOwnedStory(user, id);
    if (!s.intros.some((i) => i.id === iid)) throw new HttpError(404, "not_found");
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof b.label === "string") data.label = b.label.slice(0, 30);
    if (typeof b.introText === "string") data.introText = b.introText.slice(0, 2000);
    if (typeof b.firstMessage === "string") data.firstMessage = b.firstMessage.slice(0, 1000);
    return Response.json(await db.intro.update({ where: { id: iid }, data }));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id, iid } = await params;
    const user = await requireUser();
    const s = await requireOwnedStory(user, id);
    if (s.intros.length <= 1)
      throw new HttpError(422, "last_intro", "A story needs at least one opening.");
    await db.intro.delete({ where: { id: iid } });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
