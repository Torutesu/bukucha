import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/auth";
import { requireOwnedStory } from "@/server/stories";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await requireOwnedStory(user, id);
    const since = new Date(Date.now() - 14 * 86400_000);
    const routes = await db.route.findMany({
      where: { storyId: id, createdAt: { gte: since } },
      select: { createdAt: true },
    });
    const daily: { date: string; routeCount: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400_000);
      const key = day.toISOString().slice(0, 10);
      daily.push({
        date: key,
        routeCount: routes.filter((s) => s.createdAt.toISOString().slice(0, 10) === key)
          .length,
      });
    }
    return Response.json({ daily });
  } catch (e) {
    return errorResponse(e);
  }
}
