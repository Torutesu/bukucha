import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/auth";

type Params = { params: Promise<{ pid: string }> };

async function owned(userId: string, pid: string) {
  const p = await db.persona.findUnique({ where: { id: pid } });
  if (!p || p.userId !== userId) throw new HttpError(404, "not_found");
  return p;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { pid } = await params;
    const user = await requireUser();
    await owned(user.id, pid);
    const b = await req.json();
    if (b.isDefault) {
      await db.persona.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    }
    const data: Record<string, unknown> = {};
    if (typeof b.name === "string") data.name = b.name.slice(0, 20);
    if (typeof b.callName === "string" || b.callName === null)
      data.callName = b.callName ? String(b.callName).slice(0, 20) : null;
    if (typeof b.profile === "string" || b.profile === null)
      data.profile = b.profile ? String(b.profile).slice(0, 500) : null;
    if (b.isDefault !== undefined) data.isDefault = Boolean(b.isDefault);
    return Response.json(await db.persona.update({ where: { id: pid }, data }));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { pid } = await params;
    const user = await requireUser();
    await owned(user.id, pid);
    await db.persona.delete({ where: { id: pid } });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
