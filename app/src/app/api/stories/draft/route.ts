import { requireUser, errorResponse } from "@/lib/auth";
import { createDraftFromPremise } from "@/server/stories";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { fantasy } = await req.json();
    return Response.json(await createDraftFromPremise(user, String(fantasy ?? "")));
  } catch (e) {
    return errorResponse(e);
  }
}
