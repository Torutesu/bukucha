import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { requireOwnedSituation } from "@/server/situations";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const s = await requireOwnedSituation(user, id);
    if (s.intros.length >= 3) throw new HttpError(422, "too_many", "開始シチュは3つまでです");
    const b = await req.json();
    const iv = await db.introVariant.create({
      data: {
        situationId: id,
        label: String(b.label ?? "新しいはじまり").slice(0, 30),
        introText: String(b.introText ?? "").slice(0, 2000),
        firstMessage: String(b.firstMessage ?? "").slice(0, 1000),
        sortOrder: s.intros.length,
      },
    });
    return Response.json(iv);
  } catch (e) {
    return errorResponse(e);
  }
}
