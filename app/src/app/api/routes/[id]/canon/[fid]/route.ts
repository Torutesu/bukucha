import { requireUser, errorResponse } from "@/lib/auth";
import { updateCanon } from "@/server/canon";

type Params = { params: Promise<{ id: string; fid: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id, fid } = await params;
    const user = await requireUser();
    const b = await req.json();
    return Response.json(
      await updateCanon(user.id, id, fid, {
        ...(b.statement !== undefined ? { statement: String(b.statement) } : {}),
        ...(b.subject !== undefined ? { subject: String(b.subject) } : {}),
        ...(b.pinned !== undefined ? { pinned: Boolean(b.pinned) } : {}),
        ...(b.isActive !== undefined ? { isActive: Boolean(b.isActive) } : {}),
      })
    );
  } catch (e) {
    return errorResponse(e);
  }
}
