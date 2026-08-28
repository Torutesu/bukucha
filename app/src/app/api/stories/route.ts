import { requireUser, errorResponse } from "@/lib/auth";
import { createBlankStory } from "@/server/stories";

export async function POST() {
  try {
    const user = await requireUser();
    return Response.json(await createBlankStory(user));
  } catch (e) {
    return errorResponse(e);
  }
}
