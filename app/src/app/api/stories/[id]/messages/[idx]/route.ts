import { requireUser, errorResponse } from "@/lib/auth";
import { editMessage } from "@/server/stories";

type Params = { params: Promise<{ id: string; idx: string }> };

// AI応答のペン編集(AIロールのみ)
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id, idx } = await params;
    const user = await requireUser();
    const { content } = await req.json();
    const msg = await editMessage(user, id, Number(idx), String(content ?? ""));
    return Response.json({ idx: msg.idx, content: msg.content });
  } catch (e) {
    return errorResponse(e);
  }
}
