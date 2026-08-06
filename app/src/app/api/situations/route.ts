import { requireUser, errorResponse } from "@/lib/auth";
import { createBlankSituation } from "@/server/situations";

export async function POST() {
  try {
    const user = await requireUser();
    return Response.json(await createBlankSituation(user));
  } catch (e) {
    return errorResponse(e);
  }
}
