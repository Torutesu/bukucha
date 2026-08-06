import { requireUser, errorResponse } from "@/lib/auth";
import { assertMessageQuota } from "@/lib/ratelimit";
import { storyTurn } from "@/server/stories";
import { sseResponse } from "@/server/sse";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await assertMessageQuota(user);
    const b = await req.json();
    return sseResponse(() =>
      storyTurn(user, id, {
        content: String(b.content ?? ""),
        selectedChoiceId: b.selectedChoiceId ? String(b.selectedChoiceId) : undefined,
      })
    );
  } catch (e) {
    return errorResponse(e);
  }
}
