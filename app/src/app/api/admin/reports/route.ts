import { requireAdmin, errorResponse } from "@/lib/auth";
import { listReports } from "@/server/admin";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const raw = url.searchParams.get("status") ?? "OPEN";
    const status = raw === "RESOLVED" || raw === "DISMISSED" ? raw : "OPEN";
    return Response.json(await listReports(status, url.searchParams.get("cursor") ?? undefined));
  } catch (e) {
    return errorResponse(e);
  }
}
