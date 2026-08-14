import { requireAdmin, errorResponse } from "@/lib/auth";
import { listSituationsAdmin } from "@/server/admin";

const STATUSES = ["DRAFT", "PUBLISHED", "PRIVATE", "SUSPENDED"] as const;

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const raw = url.searchParams.get("status");
    const status = STATUSES.find((s) => s === raw);
    return Response.json(
      await listSituationsAdmin({
        q: url.searchParams.get("q") ?? undefined,
        status,
        cursor: url.searchParams.get("cursor") ?? undefined,
      })
    );
  } catch (e) {
    return errorResponse(e);
  }
}
