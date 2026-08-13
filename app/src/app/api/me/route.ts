import { db } from "@/lib/db";
import { requireUser, errorResponse, HttpError, clearSessionCookie } from "@/lib/auth";
import { isAdult } from "@/lib/policy";

export async function GET() {
  try {
    const user = await requireUser();
    const personas = await db.persona.findMany({ where: { userId: user.id } });
    return Response.json({ ...user, personas, isAdult: isAdult(user) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const b = await req.json();
    const data: Record<string, unknown> = {};
    if (typeof b.nickname === "string" && b.nickname.trim())
      data.nickname = b.nickname.trim().slice(0, 20);
    if (typeof b.avatarUrl === "string" || b.avatarUrl === null) data.avatarUrl = b.avatarUrl;
    if (Array.isArray(b.preferenceTags))
      data.preferenceTags = b.preferenceTags.slice(0, 12).map(String);
    if (typeof b.bio === "string") data.bio = b.bio.slice(0, 100);
    if (b.agreeTerms === true) data.agreedAt = new Date();

    if (typeof b.handle === "string") {
      const h = b.handle.trim().toLowerCase();
      if (!/^[a-z0-9_.]{3,20}$/.test(h))
        throw new HttpError(422, "invalid_handle", "IDは3〜20文字の英数字・_・.のみ使えます");
      data.handle = h;
    }

    if (b.birthDate !== undefined) {
      // 一度設定したら変更不可(SCR-018)
      if (user.birthDate) throw new HttpError(422, "birthdate_locked", "生年月日は変更できません");
      const d = new Date(String(b.birthDate));
      if (isNaN(d.getTime()) || d > new Date())
        throw new HttpError(422, "invalid_birthdate", "生年月日が不正です");
      data.birthDate = d;
    }

    if (b.safeFilterOff !== undefined) {
      const nextBirth = (data.birthDate as Date | undefined) ?? user.birthDate;
      if (b.safeFilterOff === true && !isAdult({ birthDate: nextBirth ?? null })) {
        // 不変条件#1: サーバー側で強制
        throw new HttpError(403, "age_restricted", "18歳になったら解除できます");
      }
      data.safeFilterOff = Boolean(b.safeFilterOff);
    }

    const updated = await db.user
      .update({ where: { id: user.id }, data })
      .catch((e: unknown) => {
        if ((e as { code?: string })?.code === "P2002")
          throw new HttpError(409, "handle_taken", "このIDは既に使われています");
        throw e;
      });
    return Response.json({ ...updated, isAdult: isAdult(updated) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    // 退会: 作品はSUSPENDED、ユーザーは匿名化 [ASSUMED SCR-018]
    await db.$transaction([
      db.situation.updateMany({ where: { authorId: user.id }, data: { status: "SUSPENDED" } }),
      db.user.update({
        where: { id: user.id },
        data: { email: null, nickname: "退会したユーザー", avatarUrl: null },
      }),
    ]);
    await clearSessionCookie();
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
