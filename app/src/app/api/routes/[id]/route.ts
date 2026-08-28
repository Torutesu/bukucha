import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/auth";
import { getRoute } from "@/server/routes";
import { endingRadar } from "@/server/endings";
import { currentLevel } from "@/lib/prompt";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const route = await getRoute(user, id);
    // Flatten the stat state for the HUD, and hand back the radar so the reader
    // sees how close a locked ending is without being told which one.
    const statView = route.intro.stats.map((def) => {
      const value = route.stats.find((s) => s.statDefId === def.id)?.value ?? def.initialValue;
      return {
        id: def.id,
        key: def.key,
        name: def.name,
        icon: def.icon,
        value,
        min: def.minValue,
        max: def.maxValue,
        level: currentLevel({ def, value })?.name ?? null,
      };
    });
    return Response.json({ ...route, statView, radar: await endingRadar(id) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await getRoute(user, id);
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (b.status === "ACTIVE" || b.status === "ENDED" || b.status === "ARCHIVED")
      data.status = b.status;
    if (typeof b.personaId === "string" || b.personaId === null) data.personaId = b.personaId;
    return Response.json(await db.route.update({ where: { id }, data }));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    await getRoute(user, id);
    await db.route.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
