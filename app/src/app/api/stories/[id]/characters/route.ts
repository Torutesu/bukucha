import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { requireOwnedStory } from "@/server/stories";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const s = await requireOwnedStory(user, id);
    if (s.characters.length >= 3) throw new HttpError(422, "too_many", "Three characters is the limit for now.");
    const b = await req.json();
    const c = await db.character.create({
      data: {
        storyId: id,
        name: String(b.name ?? "New character").slice(0, 40),
        personality: String(b.personality ?? ""),
        speechStyle: String(b.speechStyle ?? ""),
        relationship: String(b.relationship ?? ""),
        exampleDialogs: Array.isArray(b.exampleDialogs) ? b.exampleDialogs.slice(0, 5) : [],
        profileImageUrl: b.profileImageUrl ?? null,
        sortOrder: s.characters.length,
      },
    });
    return Response.json(c);
  } catch (e) {
    return errorResponse(e);
  }
}
