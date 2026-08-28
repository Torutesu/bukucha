import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const status = new URL(req.url).searchParams.get("status");
    const items = await db.story.findMany({
      where: {
        authorId: user.id,
        ...(status === "DRAFT" || status === "PRIVATE" || status === "PUBLISHED"
          ? { status }
          : { status: { not: "SUSPENDED" } }),
      },
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return Response.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}
