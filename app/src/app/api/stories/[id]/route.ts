import { db } from "@/lib/db";
import { getSessionUser, requireUser, errorResponse } from "@/lib/auth";
import { requireOwnedStory, storyDetail } from "@/server/stories";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    return Response.json(await storyDetail(user, id));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await requireOwnedStory(user, id);
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.title === "string") data.title = body.title.slice(0, 60);
    if (typeof body.logline === "string") data.logline = body.logline.slice(0, 60);
    if (typeof body.worldSetting === "string") data.worldSetting = body.worldSetting.slice(0, 4000);
    if (typeof body.coverImageUrl === "string" || body.coverImageUrl === null)
      data.coverImageUrl = body.coverImageUrl;
    if (body.contentLevel === "ALL_AGES" || body.contentLevel === "TEEN")
      data.contentLevel = body.contentLevel;
    const updated = await db.story.update({ where: { id }, data });
    if (Array.isArray(body.tagIds)) {
      await db.storyTag.deleteMany({ where: { storyId: id } });
      await db.storyTag.createMany({
        data: body.tagIds.slice(0, 6).map((tagId: string) => ({ storyId: id, tagId })),
        skipDuplicates: true,
      });
    }
    return Response.json(updated);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await requireOwnedStory(user, id);
    // Soft delete: routes people are already playing keep working.
    await db.story.update({ where: { id }, data: { status: "SUSPENDED" } });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
