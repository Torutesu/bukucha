import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { migrateGuestStory } from "@/server/stories";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { guestStory } = await req.json();
    if (!guestStory?.situationId || !guestStory?.introVariantId)
      throw new HttpError(422, "invalid_guest_story");
    const story = await migrateGuestStory(user, {
      situationId: String(guestStory.situationId),
      introVariantId: String(guestStory.introVariantId),
      messages: Array.isArray(guestStory.messages)
        ? guestStory.messages
            .filter((m: { role?: string }) => m.role === "USER" || m.role === "AI")
            .map((m: { role: "USER" | "AI"; content?: string }) => ({
              role: m.role,
              content: String(m.content ?? ""),
            }))
        : [],
    });
    return Response.json(story);
  } catch (e) {
    return errorResponse(e);
  }
}
