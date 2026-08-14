import { requireAdmin, errorResponse, HttpError } from "@/lib/auth";
import { situationAdminAction, type SituationAdminAction } from "@/server/admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const b = await req.json();
    const note = typeof b.note === "string" ? b.note : undefined;
    let input: SituationAdminAction;
    if (b.action === "suspend" || b.action === "restore" || b.action === "force_publish") {
      input = { action: b.action, note };
    } else if (b.action === "set_level" && (b.level === "ALL_AGES" || b.level === "R15")) {
      input = { action: "set_level", level: b.level, note };
    } else {
      throw new HttpError(422, "invalid_action");
    }
    return Response.json(await situationAdminAction(admin, id, input));
  } catch (e) {
    return errorResponse(e);
  }
}
