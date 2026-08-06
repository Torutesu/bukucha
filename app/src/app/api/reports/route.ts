import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const b = await req.json();
    const targetType = String(b.targetType ?? "");
    if (!["situation", "message"].includes(targetType))
      throw new HttpError(422, "invalid_target");
    const report = await db.report.create({
      data: {
        reporterId: user.id,
        targetType,
        targetId: String(b.targetId ?? ""),
        reason: String(b.reason ?? "その他").slice(0, 50),
        detail: b.detail ? String(b.detail).slice(0, 1000) : null,
      },
    });
    return Response.json({ id: report.id });
  } catch (e) {
    return errorResponse(e);
  }
}
