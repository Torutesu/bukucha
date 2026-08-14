import { requireAdmin, errorResponse } from "@/lib/auth";
import { overview } from "@/server/admin";

export async function GET() {
  try {
    await requireAdmin();
    return Response.json(await overview());
  } catch (e) {
    return errorResponse(e);
  }
}
