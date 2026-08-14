import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import {
  overview,
  listReports,
  resolveReport,
  listFlags,
  reviewFlag,
  listSituationsAdmin,
  situationAdminAction,
  listUsersAdmin,
  userAdminAction,
  listAuditLogs,
} from "@/server/admin";
import type { User } from "@prisma/client";

/**
 * 運営管理MCPサーバー(stdio)。/admin 画面と同じ server/admin.ts を直接呼ぶ。
 * 起動: DATABASE_URL=... ADMIN_EMAIL=... npm run mcp:admin
 *
 * 実行者は ADMIN_EMAIL のユーザー(role=ADMIN必須)。全操作はそのユーザー名義で
 * AuditLog に記録されるため、エージェント用の運営アカウントを分けておくと追跡しやすい。
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "seed-author@bukucha.local";

/** 毎回検証する: サーバー起動後にrole/BANが変わっても即座に反映されるように */
async function requireActor(): Promise<User> {
  const u = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!u) throw new HttpError(401, "actor_not_found", `ADMIN_EMAIL のユーザーが存在しません: ${ADMIN_EMAIL}`);
  if (u.status === "BANNED") throw new HttpError(403, "banned", "このアカウントは利用停止されています");
  if (u.role !== "ADMIN") throw new HttpError(403, "forbidden", `${ADMIN_EMAIL} は role=ADMIN ではありません`);
  return u;
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(e: unknown) {
  const msg =
    e instanceof HttpError
      ? `${e.code}: ${e.message}`
      : e instanceof Error
        ? e.message
        : String(e);
  return { content: [{ type: "text" as const, text: msg }], isError: true };
}

const run = async (fn: () => Promise<unknown>) => {
  try {
    return ok(await fn());
  } catch (e) {
    return fail(e);
  }
};

const server = new McpServer({ name: "bukucha-admin", version: "1.0.0" });

server.registerTool(
  "admin_overview",
  {
    description:
      "運営ダッシュボードの概況を取得する(未対応の通報数・未レビューの審査フラグ数・公開/停止作品数・ユーザー数・BAN数)。まずこれで全体像を把握する",
    inputSchema: {},
  },
  async () => run(async () => (await requireActor(), overview()))
);

server.registerTool(
  "admin_list_reports",
  {
    description:
      "ユーザーからの通報一覧を取得する。デフォルトはOPEN(未対応)。通報対象がsituationの場合は現況(タイトル・状態)も返る",
    inputSchema: {
      status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]).default("OPEN").describe("通報の状態"),
      cursor: z.string().optional().describe("前回レスポンスの nextCursor"),
    },
  },
  async ({ status, cursor }) => run(async () => (await requireActor(), listReports(status, cursor)))
);

server.registerTool(
  "admin_resolve_report",
  {
    description:
      "通報を処理する。RESOLVED=対応済み / DISMISSED=却下。コンテンツ自体の停止は admin_situation_action で別途行う",
    inputSchema: {
      id: z.string().describe("通報ID"),
      status: z.enum(["RESOLVED", "DISMISSED"]),
      note: z.string().optional().describe("対応メモ(通報レコードと監査ログに残る)"),
    },
  },
  async ({ id, status, note }) =>
    run(async () => resolveReport(await requireActor(), id, { status, note }))
);

server.registerTool(
  "admin_list_flags",
  {
    description:
      "公開時審査で作られたフラグ(IP検出・禁止表現・表現水準超過)の一覧。デフォルトはFLAGGED(未レビュー)。対象作品と作者も返る",
    inputSchema: {
      status: z.enum(["FLAGGED", "APPROVED", "REJECTED"]).default("FLAGGED"),
      cursor: z.string().optional(),
    },
  },
  async ({ status, cursor }) => run(async () => (await requireActor(), listFlags(status, cursor)))
);

server.registerTool(
  "admin_review_flag",
  {
    description:
      "審査フラグをレビューする。APPROVED=誤検出(公開の妨げにしない) / REJECTED=検出は正当。作品の未レビューフラグが全て解消された後、admin_situation_action の force_publish で公開できる",
    inputSchema: {
      id: z.string().describe("フラグID"),
      status: z.enum(["APPROVED", "REJECTED"]),
      note: z.string().optional().describe("判断理由(監査ログに残る)"),
    },
  },
  async ({ id, status, note }) =>
    run(async () => reviewFlag(await requireActor(), id, { status, note }))
);

server.registerTool(
  "admin_list_situations",
  {
    description:
      "作品(シチュエーション)を検索する。qはタイトル・作者ニックネームの部分一致またはID完全一致。未レビューのフラグも一緒に返る",
    inputSchema: {
      q: z.string().optional().describe("検索語"),
      status: z.enum(["DRAFT", "PUBLISHED", "PRIVATE", "SUSPENDED"]).optional(),
      cursor: z.string().optional(),
    },
  },
  async (input) => run(async () => (await requireActor(), listSituationsAdmin(input)))
);

server.registerTool(
  "admin_situation_action",
  {
    description:
      "作品への運営操作。suspend=停止 / restore=停止解除(公開実績があれば公開に戻る) / force_publish=審査バイパス公開(未レビューのフラグが残っていると拒否される) / set_level=表現レベル変更(levelが必須)",
    inputSchema: {
      id: z.string().describe("作品ID"),
      action: z.enum(["suspend", "restore", "force_publish", "set_level"]),
      level: z.enum(["ALL_AGES", "R15"]).optional().describe("set_level時のみ"),
      note: z.string().optional().describe("操作理由(監査ログに残る)"),
    },
  },
  async ({ id, action, level, note }) =>
    run(async () => {
      const actor = await requireActor();
      if (action === "set_level") {
        if (!level) throw new HttpError(422, "level_required", "set_level には level が必要です");
        return situationAdminAction(actor, id, { action, level, note });
      }
      return situationAdminAction(actor, id, { action, note });
    })
);

server.registerTool(
  "admin_list_users",
  {
    description:
      "ユーザーを検索する。qはニックネーム・メールの部分一致またはID完全一致。作品数・物語数・通報数も返る",
    inputSchema: {
      q: z.string().optional(),
      cursor: z.string().optional(),
    },
  },
  async (input) => run(async () => (await requireActor(), listUsersAdmin(input)))
);

server.registerTool(
  "admin_user_action",
  {
    description:
      "ユーザーへの運営操作。ban=利用停止(公開中の作品も同時停止・ログイン拒否) / unban=解除 / grant_badge・revoke_badge=クリエイターバッジ / set_role=権限変更(roleが必須)。自分自身へのban/set_roleは拒否される",
    inputSchema: {
      id: z.string().describe("ユーザーID"),
      action: z.enum(["ban", "unban", "grant_badge", "revoke_badge", "set_role"]),
      role: z.enum(["USER", "ADMIN"]).optional().describe("set_role時のみ"),
      note: z.string().optional().describe("操作理由(監査ログに残る)"),
    },
  },
  async ({ id, action, role, note }) =>
    run(async () => {
      const actor = await requireActor();
      if (action === "set_role") {
        if (!role) throw new HttpError(422, "role_required", "set_role には role が必要です");
        return userAdminAction(actor, id, { action, role });
      }
      if (action === "ban" || action === "unban") {
        return userAdminAction(actor, id, { action, note });
      }
      return userAdminAction(actor, id, { action });
    })
);

server.registerTool(
  "admin_list_audit_logs",
  {
    description: "運営操作の監査ログを新しい順に取得する(人間の/admin操作もMCP経由の操作も全て記録される)",
    inputSchema: { cursor: z.string().optional() },
  },
  async ({ cursor }) => run(async () => (await requireActor(), listAuditLogs(cursor)))
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`bukucha-admin MCP server ready (actor: ${ADMIN_EMAIL})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
