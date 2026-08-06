import { getSessionUser, errorResponse } from "@/lib/auth";
import { homeSections } from "@/server/situations";

export async function GET() {
  try {
    const user = await getSessionUser();
    return Response.json({ sections: await homeSections(user) });
  } catch (e) {
    return errorResponse(e);
  }
}
