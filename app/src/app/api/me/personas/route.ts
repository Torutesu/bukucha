import { db } from "@/lib/db";
import { requireUser, errorResponse } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json(await db.persona.findMany({ where: { userId: user.id } }));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const b = await req.json();
    if (b.isDefault) {
      await db.persona.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    }
    const persona = await db.persona.create({
      data: {
        userId: user.id,
        name: String(b.name ?? "You").slice(0, 40),
        callName: b.callName ? String(b.callName).slice(0, 20) : null,
        profile: b.profile ? String(b.profile).slice(0, 500) : null,
        isDefault: Boolean(b.isDefault),
      },
    });
    return Response.json(persona);
  } catch (e) {
    return errorResponse(e);
  }
}
