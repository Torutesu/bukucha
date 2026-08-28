import { getSessionUser, errorResponse } from "@/lib/auth";
import { search } from "@/server/stories";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    const p = new URL(req.url).searchParams;
    const result = await search(
      user,
      p.get("q") ?? "",
      (p.get("tags") ?? "").split(",").filter(Boolean),
      p.get("sort") === "new" ? "new" : "popular",
      p.get("cursor") ?? undefined
    );
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
