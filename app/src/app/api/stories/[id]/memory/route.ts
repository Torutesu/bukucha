import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/auth";
import { getStory } from "@/server/stories";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const story = await getStory(user, id);
    return Response.json({
      summary: story.memory?.summary ?? "",
      userNote: story.memory?.userNote ?? "",
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await getStory(user, id);
    const { userNote } = await req.json();
    await db.storyMemory.upsert({
      where: { storyId: id },
      update: { userNote: String(userNote ?? "").slice(0, 2000) },
      create: { storyId: id, userNote: String(userNote ?? "").slice(0, 2000) },
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
