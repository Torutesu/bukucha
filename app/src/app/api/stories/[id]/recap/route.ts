import { requireUser, errorResponse } from "@/lib/auth";
import { refreshRecap } from "@/server/stories";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    return Response.json(await refreshRecap(user, id));
  } catch (e) {
    return errorResponse(e);
  }
}
