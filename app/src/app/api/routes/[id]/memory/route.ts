import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/auth";
import { getRoute } from "@/server/routes";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const route = await getRoute(user, id);
    return Response.json({
      summary: route.memory?.summary ?? "",
      userNote: route.memory?.userNote ?? "",
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await getRoute(user, id);
    const { userNote } = await req.json();
    await db.routeMemory.upsert({
      where: { routeId: id },
      update: { userNote: String(userNote ?? "").slice(0, 2000) },
      create: { routeId: id, userNote: String(userNote ?? "").slice(0, 2000) },
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
