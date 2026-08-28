import { requireUser, errorResponse } from "@/lib/auth";
import { toggleLike } from "@/server/stories";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    return Response.json(await toggleLike(user, id, true));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    return Response.json(await toggleLike(user, id, false));
  } catch (e) {
    return errorResponse(e);
  }
}
