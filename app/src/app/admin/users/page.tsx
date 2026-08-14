"use client";

import { useState } from "react";
import { adminFetch, useAdminList, Badge, ListState, LoadMore, fmtDate } from "../ui";

interface UserRow {
  id: string;
  email: string | null;
  nickname: string;
  role: string;
  status: "ACTIVE" | "BANNED";
  isCreatorBadge: boolean;
  createdAt: string;
  _count: { situations: number; stories: number; reports: number };
}

export default function AdminUsers() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const path = `/api/admin/users${query ? `?q=${encodeURIComponent(query)}` : ""}`;
  const { items, nextCursor, error, reload, loadMore } = useAdminList<UserRow>(path);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, body: Record<string, string | undefined>) => {
    setBusy(id);
    try {
      await adminFetch(`/api/admin/users/${id}`, { method: "POST", body: JSON.stringify(body) });
      await reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(q.trim());
        }}
      >
        <input
          className="input"
          placeholder="ニックネーム・メール・IDで検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn-ghost shrink-0 text-sm">検索</button>
      </form>
      <ListState items={items} error={error} empty="ユーザーが見つかりません" />
      {items?.map((u) => (
        <div key={u.id} className="card space-y-2 p-4" data-testid="user-row">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold">
              {u.nickname}
              {u.isCreatorBadge && " ✒"}
            </span>
            <div className="flex gap-1">
              {u.role === "ADMIN" && <Badge tone="ok">ADMIN</Badge>}
              {u.status === "BANNED" && <Badge tone="warn">BAN</Badge>}
            </div>
          </div>
          <p className="text-xs" style={{ color: "var(--c-textMuted)" }}>
            {u.email ?? "(メール未設定)"} / 作品{u._count.situations} / 物語{u._count.stories} /{" "}
            {fmtDate(u.createdAt)}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {u.status === "ACTIVE" ? (
              <button
                className="btn-ghost text-sm"
                disabled={busy === u.id}
                onClick={() => {
                  const note = window.prompt("BAN理由(監査ログに残ります)。公開中の作品も停止されます");
                  if (note !== null) act(u.id, { action: "ban", note });
                }}
              >
                BANする
              </button>
            ) : (
              <button
                className="btn-ghost text-sm"
                disabled={busy === u.id}
                onClick={() => act(u.id, { action: "unban" })}
              >
                BAN解除
              </button>
            )}
            <button
              className="btn-ghost text-sm"
              disabled={busy === u.id}
              onClick={() =>
                act(u.id, { action: u.isCreatorBadge ? "revoke_badge" : "grant_badge" })
              }
            >
              {u.isCreatorBadge ? "バッジ剥奪" : "バッジ付与"}
            </button>
            <button
              className="btn-ghost text-sm"
              disabled={busy === u.id}
              onClick={() => {
                const next = u.role === "ADMIN" ? "USER" : "ADMIN";
                if (window.confirm(`権限を ${next} に変更しますか?`))
                  act(u.id, { action: "set_role", role: next });
              }}
            >
              {u.role === "ADMIN" ? "ADMIN解除" : "ADMIN化"}
            </button>
          </div>
        </div>
      ))}
      <LoadMore nextCursor={nextCursor} onClick={loadMore} />
    </div>
  );
}
