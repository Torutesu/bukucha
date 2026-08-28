import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { requireOwnedStory } from "@/server/stories";

type Params = { params: Promise<{ id: string; cid: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id, cid } = await params;
    const user = await requireUser();
    const s = await requireOwnedStory(user, id);
    if (!s.characters.some((c) => c.id === cid)) throw new HttpError(404, "not_found");
    const b = await req.json();
    const data: Record<string, unknown> = {};
    for (const key of ["name", "personality", "speechStyle", "relationship"] as const) {
      if (typeof b[key] === "string") data[key] = b[key].slice(0, key === "name" ? 30 : 1000);
    }
    if (typeof b.profileImageUrl === "string" || b.profileImageUrl === null)
      data.profileImageUrl = b.profileImageUrl;
    if (Array.isArray(b.exampleDialogs)) data.exampleDialogs = b.exampleDialogs.slice(0, 5);
    if (typeof b.sortOrder === "number") data.sortOrder = b.sortOrder;
    return Response.json(await db.character.update({ where: { id: cid }, data }));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id, cid } = await params;
    const user = await requireUser();
    const s = await requireOwnedStory(user, id);
    if (s.characters.length <= 1)
      throw new HttpError(422, "last_character", "最後の1人は削除できません");
    await db.character.delete({ where: { id: cid } });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
