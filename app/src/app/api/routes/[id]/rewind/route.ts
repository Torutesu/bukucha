import { requireUser, errorResponse } from "@/lib/auth";
import { rewindRoute } from "@/server/routes";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const { toIdx } = await req.json();
    return Response.json(await rewindRoute(user, id, Number(toIdx)));
  } catch (e) {
    return errorResponse(e);
  }
}
