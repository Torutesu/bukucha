import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const situations = await db.situation.findMany({
      where: { authorId: user.id },
      select: { id: true },
    });
    const ids = situations.map((s) => s.id);
    const now = Date.now();
    const week = new Date(now - 7 * 86400_000);
    const prevWeek = new Date(now - 14 * 86400_000);

    const [weekReaders, prevReaders, weekLikes, prevLikes] = await Promise.all([
      db.story.count({ where: { situationId: { in: ids }, createdAt: { gte: week } } }),
      db.story.count({
        where: { situationId: { in: ids }, createdAt: { gte: prevWeek, lt: week } },
      }),
      db.like.count({ where: { situationId: { in: ids }, createdAt: { gte: week } } }),
      db.like.count({
        where: { situationId: { in: ids }, createdAt: { gte: prevWeek, lt: week } },
      }),
    ]);
    return Response.json({
      weekReaders,
      weekReadersDelta: weekReaders - prevReaders,
      weekLikes,
      weekLikesDelta: weekLikes - prevLikes,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
