import { db } from "@/lib/db";
import { HttpError } from "@/lib/auth";
import type { ContentLevel, Prisma, User } from "@prisma/client";

/**
 * 運営オペレーション層。認可(role=ADMIN)は呼び出し側の requireAdmin が担い、
 * ここは操作+監査ログ記録のみに責任を持つ。/api/admin/* からも将来のMCP/CLIからも
 * 同じ関数を使う想定で、UIに依存しない入出力にする。
 */

const PAGE = 20;

async function audit(
  admin: User,
  action: string,
  targetType: string,
  targetId: string,
  detail = ""
) {
  await db.auditLog.create({
    data: { actorId: admin.id, action, targetType, targetId, detail },
  });
}

function page<T extends { id: string }>(items: T[]) {
  const nextCursor = items.length > PAGE ? items[PAGE].id : null;
  return { items: items.slice(0, PAGE), nextCursor };
}

// ============ ダッシュボード ============

export async function overview() {
  const [openReports, flagged, published, suspended, users, banned] = await Promise.all([
    db.report.count({ where: { status: "OPEN" } }),
    db.moderationFlag.count({ where: { status: "FLAGGED" } }),
    db.situation.count({ where: { status: "PUBLISHED" } }),
    db.situation.count({ where: { status: "SUSPENDED" } }),
    db.user.count(),
    db.user.count({ where: { status: "BANNED" } }),
  ]);
  return { openReports, flagged, published, suspended, users, banned };
}

// ============ 通報キュー ============

export async function listReports(status: "OPEN" | "RESOLVED" | "DISMISSED", cursor?: string) {
  const items = await db.report.findMany({
    where: { status },
    include: { reporter: { select: { id: true, nickname: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  // 通報対象の現況をまとめて引く(situation通報のみタイトル解決)
  const sitIds = items.filter((r) => r.targetType === "situation").map((r) => r.targetId);
  const sits = sitIds.length
    ? await db.situation.findMany({
        where: { id: { in: sitIds } },
        select: { id: true, title: true, status: true, authorId: true },
      })
    : [];
  const byId = new Map(sits.map((s) => [s.id, s]));
  const withTarget = items.map((r) => ({ ...r, targetSituation: byId.get(r.targetId) ?? null }));
  return page(withTarget);
}

export async function resolveReport(
  admin: User,
  id: string,
  input: { status: "RESOLVED" | "DISMISSED"; note?: string }
) {
  const report = await db.report.findUnique({ where: { id } });
  if (!report) throw new HttpError(404, "not_found");
  if (report.status !== "OPEN") throw new HttpError(409, "already_resolved", "処理済みの通報です");
  const updated = await db.report.update({
    where: { id },
    data: {
      status: input.status,
      resolvedById: admin.id,
      resolvedAt: new Date(),
      resolutionNote: input.note?.slice(0, 1000) ?? null,
    },
  });
  await audit(admin, `report.${input.status.toLowerCase()}`, "report", id, input.note ?? "");
  return updated;
}

// ============ 審査フラグ(公開ブロックのレビュー) ============

export async function listFlags(
  status: "FLAGGED" | "APPROVED" | "REJECTED",
  cursor?: string
) {
  const items = await db.moderationFlag.findMany({
    where: { status },
    include: {
      situation: {
        select: { id: true, title: true, status: true, author: { select: { id: true, nickname: true } } },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  return page(items);
}

/**
 * APPROVED = 誤検出(このフラグは公開の妨げにしない)。
 * REJECTED = 検出は正当(ブロック維持)。公開の解除は situation 操作(force_publish)で行う。
 */
export async function reviewFlag(
  admin: User,
  id: string,
  input: { status: "APPROVED" | "REJECTED"; note?: string }
) {
  const flag = await db.moderationFlag.findUnique({ where: { id } });
  if (!flag) throw new HttpError(404, "not_found");
  if (flag.status !== "FLAGGED") throw new HttpError(409, "already_reviewed", "レビュー済みです");
  const updated = await db.moderationFlag.update({
    where: { id },
    data: {
      status: input.status,
      reviewedById: admin.id,
      reviewedAt: new Date(),
      reviewNote: input.note?.slice(0, 1000) ?? null,
    },
  });
  await audit(admin, `flag.${input.status.toLowerCase()}`, "moderationFlag", id, flag.detail);
  return updated;
}

// ============ 作品オペレーション ============

export async function listSituationsAdmin(params: {
  q?: string;
  status?: "DRAFT" | "PUBLISHED" | "PRIVATE" | "SUSPENDED";
  cursor?: string;
}) {
  const where: Prisma.SituationWhereInput = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.q
      ? {
          OR: [
            { id: params.q },
            { title: { contains: params.q } },
            { author: { nickname: { contains: params.q } } },
          ],
        }
      : {}),
  };
  const items = await db.situation.findMany({
    where,
    select: {
      id: true,
      title: true,
      status: true,
      contentLevel: true,
      likeCount: true,
      storyCount: true,
      publishedAt: true,
      createdAt: true,
      author: { select: { id: true, nickname: true } },
      flags: { where: { status: "FLAGGED" }, select: { id: true, kind: true, detail: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });
  return page(items);
}

export type SituationAdminAction =
  | { action: "suspend"; note?: string }
  | { action: "restore"; note?: string }
  | { action: "force_publish"; note?: string }
  | { action: "set_level"; level: ContentLevel; note?: string };

export async function situationAdminAction(admin: User, id: string, input: SituationAdminAction) {
  const s = await db.situation.findUnique({ where: { id } });
  if (!s) throw new HttpError(404, "not_found");

  if (input.action === "suspend") {
    if (s.status === "SUSPENDED") throw new HttpError(409, "already_suspended");
    await db.situation.update({ where: { id }, data: { status: "SUSPENDED" } });
  } else if (input.action === "restore") {
    if (s.status !== "SUSPENDED") throw new HttpError(409, "not_suspended");
    // 公開実績があれば公開に戻し、なければ下書きに戻す
    await db.situation.update({
      where: { id },
      data: { status: s.publishedAt ? "PUBLISHED" : "DRAFT" },
    });
  } else if (input.action === "force_publish") {
    // 誤検出レビュー後の公開解除。未レビューのFLAGGEDが残っていれば拒否(レビューを強制)
    const open = await db.moderationFlag.count({
      where: { situationId: id, status: "FLAGGED" },
    });
    if (open > 0)
      throw new HttpError(409, "flags_pending", "未レビューの審査フラグが残っています");
    await db.situation.update({
      where: { id },
      data: { status: "PUBLISHED", publishedAt: s.publishedAt ?? new Date() },
    });
  } else if (input.action === "set_level") {
    if (input.level === "R18") throw new HttpError(422, "invalid_level", "R18はMVP対象外です");
    await db.situation.update({ where: { id }, data: { contentLevel: input.level } });
  }

  await audit(
    admin,
    `situation.${input.action}`,
    "situation",
    id,
    [input.action === "set_level" ? `level=${input.level}` : "", input.note ?? ""]
      .filter(Boolean)
      .join(" ")
  );
  return db.situation.findUniqueOrThrow({
    where: { id },
    select: { id: true, status: true, contentLevel: true, publishedAt: true },
  });
}

// ============ ユーザーオペレーション ============

export async function listUsersAdmin(params: { q?: string; cursor?: string }) {
  const where: Prisma.UserWhereInput = params.q
    ? {
        OR: [
          { id: params.q },
          { email: { contains: params.q } },
          { nickname: { contains: params.q } },
        ],
      }
    : {};
  const items = await db.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      nickname: true,
      role: true,
      status: true,
      isCreatorBadge: true,
      createdAt: true,
      _count: { select: { situations: true, stories: true, reports: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });
  return page(items);
}

export type UserAdminAction =
  | { action: "ban"; note?: string }
  | { action: "unban"; note?: string }
  | { action: "grant_badge" }
  | { action: "revoke_badge" }
  | { action: "set_role"; role: "USER" | "ADMIN" };

export async function userAdminAction(admin: User, id: string, input: UserAdminAction) {
  const target = await db.user.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, "not_found");
  // 自分自身のBAN/降格による締め出しを防ぐ
  if (admin.id === id && (input.action === "ban" || input.action === "set_role"))
    throw new HttpError(422, "self_operation", "自分自身には実行できません");

  if (input.action === "ban") {
    await db.$transaction([
      db.user.update({ where: { id }, data: { status: "BANNED" } }),
      // BANユーザーの公開作品は同時に停止する
      db.situation.updateMany({
        where: { authorId: id, status: "PUBLISHED" },
        data: { status: "SUSPENDED" },
      }),
    ]);
  } else if (input.action === "unban") {
    await db.user.update({ where: { id }, data: { status: "ACTIVE" } });
  } else if (input.action === "grant_badge") {
    await db.user.update({ where: { id }, data: { isCreatorBadge: true } });
  } else if (input.action === "revoke_badge") {
    await db.user.update({ where: { id }, data: { isCreatorBadge: false } });
  } else if (input.action === "set_role") {
    await db.user.update({ where: { id }, data: { role: input.role } });
  }

  await audit(
    admin,
    `user.${input.action}`,
    "user",
    id,
    [input.action === "set_role" ? `role=${input.role}` : "", "note" in input ? input.note ?? "" : ""]
      .filter(Boolean)
      .join(" ")
  );
  return db.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, role: true, status: true, isCreatorBadge: true },
  });
}

// ============ 監査ログ ============

export async function listAuditLogs(cursor?: string) {
  const items = await db.auditLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const actorIds = [...new Set(items.map((l) => l.actorId))];
  const actors = await db.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, nickname: true },
  });
  const byId = new Map(actors.map((a) => [a.id, a.nickname]));
  const withActor = items.map((l) => ({ ...l, actorNickname: byId.get(l.actorId) ?? null }));
  return page(withActor);
}
