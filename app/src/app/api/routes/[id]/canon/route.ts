import { requireUser, errorResponse } from "@/lib/auth";
import { addCanon, listCanon } from "@/server/canon";
import type { CanonCategory } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

/** SCR-024. Reading and editing the ledger is never metered. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    return Response.json({ items: await listCanon(user.id, id) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const b = await req.json();
    return Response.json(
      await addCanon(user.id, id, {
        category: String(b.category ?? "WORLD") as CanonCategory,
        subject: String(b.subject ?? ""),
        statement: String(b.statement ?? ""),
      })
    );
  } catch (e) {
    return errorResponse(e);
  }
}
