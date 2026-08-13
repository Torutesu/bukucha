import { db } from "@/lib/db";
import { getSessionUser, requireUser, errorResponse } from "@/lib/auth";
import { requireOwnedSituation, situationDetail } from "@/server/situations";
import { parseLore, parseStyle } from "@/lib/plot-style";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    return Response.json(await situationDetail(user, id));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await requireOwnedSituation(user, id);
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof body.title === "string") data.title = body.title.slice(0, 60);
    if (typeof body.catchphrase === "string") data.catchphrase = body.catchphrase.slice(0, 60);
    if (typeof body.worldSetting === "string") data.worldSetting = body.worldSetting.slice(0, 4000);
    if (typeof body.coverImageUrl === "string" || body.coverImageUrl === null)
      data.coverImageUrl = body.coverImageUrl;
    if (body.contentLevel === "ALL_AGES" || body.contentLevel === "R15")
      data.contentLevel = body.contentLevel;
    if (body.style && typeof body.style === "object") data.style = parseStyle(body.style);
    if (Array.isArray(body.lore)) data.lore = parseLore(body.lore);
    if (typeof body.commentsEnabled === "boolean") data.commentsEnabled = body.commentsEnabled;
    if (typeof body.creatorComment === "string" || body.creatorComment === null)
      data.creatorComment = body.creatorComment ? body.creatorComment.slice(0, 500) : null;
    const updated = await db.situation.update({ where: { id }, data });
    if (Array.isArray(body.tagIds)) {
      await db.situationTag.deleteMany({ where: { situationId: id } });
      await db.situationTag.createMany({
        data: body.tagIds.slice(0, 6).map((tagId: string) => ({ situationId: id, tagId })),
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
    await requireOwnedSituation(user, id);
    // 論理削除: 既読Storyは読み続けられる(SCR-012 [ASSUMED])
    await db.situation.update({ where: { id }, data: { status: "SUSPENDED" } });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
