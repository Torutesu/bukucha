import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { db } from "@/lib/db";
import { collectionFor } from "@/server/endings";

type Params = { params: Promise<{ id: string }> };

/** SCR-022: what this reader has collected for one story. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const story = await db.story.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true },
    });
    if (!story) throw new HttpError(404, "not_found");
    const collection = await collectionFor(user.id, story.id);
    if (!collection) throw new HttpError(404, "not_found");
    return Response.json(collection);
  } catch (e) {
    return errorResponse(e);
  }
}
