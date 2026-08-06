import { requireUser, errorResponse } from "@/lib/auth";
import { createDraftFromFantasy } from "@/server/situations";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { fantasy } = await req.json();
    return Response.json(await createDraftFromFantasy(user, String(fantasy ?? "")));
  } catch (e) {
    return errorResponse(e);
  }
}
