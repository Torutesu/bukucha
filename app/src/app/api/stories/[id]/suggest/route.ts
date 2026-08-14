import { requireUser, errorResponse } from "@/lib/auth";
import { suggestReplies } from "@/server/stories";

type Params = { params: Promise<{ id: string }> };

// AIF-008: 返信候補(1日50回・朝9時JSTリセット)
export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    return Response.json(await suggestReplies(user, id));
  } catch (e) {
    return errorResponse(e);
  }
}
