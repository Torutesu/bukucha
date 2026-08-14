import { requireUser, errorResponse } from "@/lib/auth";
import { branchStory } from "@/server/stories";

type Params = { params: Promise<{ id: string }> };

// ここから分岐(並行ルート): atIdxまでを複製した新しいStoryを作る
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const { atIdx } = await req.json();
    const story = await branchStory(user, id, Number(atIdx));
    return Response.json({ id: story.id });
  } catch (e) {
    return errorResponse(e);
  }
}
