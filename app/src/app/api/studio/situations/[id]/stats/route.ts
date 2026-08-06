import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/auth";
import { requireOwnedSituation } from "@/server/situations";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await requireOwnedSituation(user, id);
    const since = new Date(Date.now() - 14 * 86400_000);
    const stories = await db.story.findMany({
      where: { situationId: id, createdAt: { gte: since } },
      select: { createdAt: true },
    });
    const daily: { date: string; storyCount: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400_000);
      const key = day.toISOString().slice(0, 10);
      daily.push({
        date: key,
        storyCount: stories.filter((s) => s.createdAt.toISOString().slice(0, 10) === key)
          .length,
      });
    }
    return Response.json({ daily });
  } catch (e) {
    return errorResponse(e);
  }
}
