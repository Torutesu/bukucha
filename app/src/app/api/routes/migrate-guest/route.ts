import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { migrateGuestRoute } from "@/server/routes";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { guestStory } = await req.json();
    if (!guestStory?.storyId || !guestStory?.introId)
      throw new HttpError(422, "invalid_guest_story");
    const route = await migrateGuestRoute(user, {
      storyId: String(guestStory.storyId),
      introId: String(guestStory.introId),
      messages: Array.isArray(guestStory.messages)
        ? guestStory.messages
            .filter((m: { role?: string }) => m.role === "USER" || m.role === "AI")
            .map((m: { role: "USER" | "AI"; content?: string }) => ({
              role: m.role,
              content: String(m.content ?? ""),
            }))
        : [],
    });
    return Response.json(route);
  } catch (e) {
    return errorResponse(e);
  }
}
