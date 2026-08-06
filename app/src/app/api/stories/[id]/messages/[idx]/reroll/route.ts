import { requireUser, errorResponse } from "@/lib/auth";
import { assertMessageQuota } from "@/lib/ratelimit";
import { storyTurn } from "@/server/stories";
import { sseResponse } from "@/server/sse";

type Params = { params: Promise<{ id: string; idx: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id, idx } = await params;
    const user = await requireUser();
    await assertMessageQuota(user);
    const b = await req.json().catch(() => ({}));
    return sseResponse(() =>
      storyTurn(user, id, {
        content: "",
        rerollIdx: Number(idx),
        instruction: b.instruction ? String(b.instruction) : undefined,
      })
    );
  } catch (e) {
    return errorResponse(e);
  }
}
