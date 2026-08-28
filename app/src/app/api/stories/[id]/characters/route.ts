import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { requireOwnedStory } from "@/server/stories";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const s = await requireOwnedStory(user, id);
    if (s.characters.length >= 3) throw new HttpError(422, "too_many", "キャラは3人までです");
    const b = await req.json();
    const c = await db.character.create({
      data: {
        storyId: id,
        name: String(b.name ?? "新しいキャラ").slice(0, 30),
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
