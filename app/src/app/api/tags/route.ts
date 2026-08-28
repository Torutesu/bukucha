import { db } from "@/lib/db";
import { getSessionUser, errorResponse } from "@/lib/auth";
import { visibleLevels } from "@/lib/policy";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    const url = new URL(req.url);
    const category = url.searchParams.get("category") ?? undefined;
    const showR15 = visibleLevels(user).includes("TEEN");
    const tags = await db.tag.findMany({
      where: { ...(category ? { category } : {}), ...(showR15 ? {} : { isR15: false }) },
      orderBy: { name: "asc" },
    });
    return Response.json(tags);
  } catch (e) {
    return errorResponse(e);
  }
}
