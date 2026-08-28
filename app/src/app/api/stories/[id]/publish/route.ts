import { requireUser, errorResponse } from "@/lib/auth";
import { publishStory } from "@/server/stories";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const { visibility } = await req.json();
    const result = await publishStory(
      user,
      id,
      visibility === "PRIVATE" ? "PRIVATE" : "PUBLISHED"
    );
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
