import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/auth";
import { getStory } from "@/server/stories";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    return Response.json(await getStory(user, id));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await getStory(user, id);
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (b.status === "ACTIVE" || b.status === "ARCHIVED") data.status = b.status;
    if (typeof b.personaId === "string" || b.personaId === null) data.personaId = b.personaId;
    return Response.json(await db.story.update({ where: { id }, data }));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await getStory(user, id);
    await db.story.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
