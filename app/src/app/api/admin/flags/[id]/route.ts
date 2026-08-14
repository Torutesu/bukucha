import { requireAdmin, errorResponse, HttpError } from "@/lib/auth";
import { reviewFlag } from "@/server/admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const b = await req.json();
    if (b.status !== "APPROVED" && b.status !== "REJECTED")
      throw new HttpError(422, "invalid_status");
    return Response.json(
      await reviewFlag(admin, id, {
        status: b.status,
        note: typeof b.note === "string" ? b.note : undefined,
      })
    );
  } catch (e) {
    return errorResponse(e);
  }
}
