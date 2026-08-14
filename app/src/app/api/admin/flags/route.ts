import { requireAdmin, errorResponse } from "@/lib/auth";
import { listFlags } from "@/server/admin";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const raw = url.searchParams.get("status") ?? "FLAGGED";
    const status = raw === "APPROVED" || raw === "REJECTED" ? raw : "FLAGGED";
    return Response.json(await listFlags(status, url.searchParams.get("cursor") ?? undefined));
  } catch (e) {
    return errorResponse(e);
  }
}
