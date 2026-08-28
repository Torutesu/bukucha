import { getSessionUser, errorResponse } from "@/lib/auth";
import { recommend } from "@/server/stories";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    const tags = (new URL(req.url).searchParams.get("tags") ?? "")
      .split(",")
      .filter(Boolean);
    return Response.json(await recommend(user, tags));
  } catch (e) {
    return errorResponse(e);
  }
}
