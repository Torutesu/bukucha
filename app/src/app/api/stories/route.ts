import { requireUser, errorResponse } from "@/lib/auth";
import { createStory, listStories } from "@/server/stories";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const b = await req.json();
    const story = await createStory(
      user,
      String(b.situationId),
      String(b.introVariantId),
      b.personaId ? String(b.personaId) : undefined
    );
    return Response.json(story);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const p = new URL(req.url).searchParams;
    const items = await listStories(
      user,
      p.get("status") === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
      p.get("situationId") ?? undefined
    );
    return Response.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}
