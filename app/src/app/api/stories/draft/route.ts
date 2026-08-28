import { requireUser, errorResponse } from "@/lib/auth";
import { createDraftFromPremise } from "@/server/stories";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { premise } = await req.json();
    return Response.json(await createDraftFromPremise(user, String(premise ?? "")));
  } catch (e) {
    return errorResponse(e);
  }
}
