import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/auth";
import { cardSelect } from "@/server/situations";
import { visibleLevels } from "@/lib/policy";

export async function GET() {
  try {
    const user = await requireUser();
    const likes = await db.like.findMany({
      where: {
        userId: user.id,
        situation: { status: "PUBLISHED", contentLevel: { in: visibleLevels(user) } },
      },
      include: { situation: { select: cardSelect } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return Response.json({ items: likes.map((l) => l.situation) });
  } catch (e) {
    return errorResponse(e);
  }
}
