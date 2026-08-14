import { requireAdmin, errorResponse } from "@/lib/auth";
import { listAuditLogs } from "@/server/admin";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    return Response.json(await listAuditLogs(url.searchParams.get("cursor") ?? undefined));
  } catch (e) {
    return errorResponse(e);
  }
}
