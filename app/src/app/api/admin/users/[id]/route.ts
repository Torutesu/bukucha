import { requireAdmin, errorResponse, HttpError } from "@/lib/auth";
import { userAdminAction, type UserAdminAction } from "@/server/admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const b = await req.json();
    const note = typeof b.note === "string" ? b.note : undefined;
    let input: UserAdminAction;
    if (b.action === "ban" || b.action === "unban") {
      input = { action: b.action, note };
    } else if (b.action === "grant_badge" || b.action === "revoke_badge") {
      input = { action: b.action };
    } else if (b.action === "set_role" && (b.role === "USER" || b.role === "ADMIN")) {
      input = { action: "set_role", role: b.role };
    } else {
      throw new HttpError(422, "invalid_action");
    }
    return Response.json(await userAdminAction(admin, id, input));
  } catch (e) {
    return errorResponse(e);
  }
}
