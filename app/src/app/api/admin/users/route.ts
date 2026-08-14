import { requireAdmin, errorResponse } from "@/lib/auth";
import { listUsersAdmin } from "@/server/admin";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    return Response.json(
      await listUsersAdmin({
        q: url.searchParams.get("q") ?? undefined,
        cursor: url.searchParams.get("cursor") ?? undefined,
      })
    );
  } catch (e) {
    return errorResponse(e);
  }
}
