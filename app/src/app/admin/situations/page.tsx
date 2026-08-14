"use client";

import { useState } from "react";
import Link from "next/link";
import { adminFetch, useAdminList, StatusTabs, Badge, ListState, LoadMore, fmtDate } from "../ui";

type Status = "ALL" | "DRAFT" | "PUBLISHED" | "PRIVATE" | "SUSPENDED";

interface SituationRow {
  id: string;
  title: string;
  status: string;
  contentLevel: string;
  likeCount: number;
  storyCount: number;
  publishedAt: string | null;
  createdAt: string;
  author: { id: string; nickname: string };
  flags: { id: string; kind: string; detail: string }[];
}

export default function AdminSituations() {
  const [status, setStatus] = useState<Status>("ALL");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const path = `/api/admin/situations?${new URLSearchParams({
    ...(status !== "ALL" ? { status } : {}),
    ...(query ? { q: query } : {}),
  })}`;
  const { items, nextCursor, error, reload, loadMore } = useAdminList<SituationRow>(path);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, body: Record<string, string | undefined>) => {
    setBusy(id);
    try {
      await adminFetch(`/api/admin/situations/${id}`, { method: "POST", body: JSON.stringify(body) });
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
          placeholder="タイトル・作者名・IDで検索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn-ghost shrink-0 text-sm">検索</button>
      </form>
      <StatusTabs
        value={status}
        onChange={setStatus}
        options={[
          { value: "ALL", label: "すべて" },
          { value: "PUBLISHED", label: "公開中" },
          { value: "SUSPENDED", label: "停止中" },
          { value: "DRAFT", label: "下書き" },
          { value: "PRIVATE", label: "非公開" },
        ]}
      />
      <ListState items={items} error={error} empty="作品が見つかりません" />
      {items?.map((s) => (
        <div key={s.id} className="card space-y-2 p-4" data-testid="situation-row">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/s/${s.id}`} className="text-sm font-bold underline">
              {s.title || "(無題)"}
            </Link>
            <Badge tone={s.status === "SUSPENDED" ? "warn" : s.status === "PUBLISHED" ? "ok" : "muted"}>
              {s.status}
            </Badge>
          </div>
          <p className="text-xs" style={{ color: "var(--c-textMuted)" }}>
            {s.author.nickname} / {s.contentLevel} / ♥{s.likeCount} / 物語{s.storyCount} /{" "}
            {fmtDate(s.createdAt)}
          </p>
          {s.flags.length > 0 && (
            <div className="space-y-1">
              {s.flags.map((f) => (
                <p key={f.id} className="text-xs" style={{ color: "var(--c-textMuted)" }}>
                  ⚑ {f.detail}
                </p>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1 text-sm">
            {s.status !== "SUSPENDED" ? (
              <button
                className="btn-ghost text-sm"
                disabled={busy === s.id}
                onClick={() => {
                  const note = window.prompt("停止理由(監査ログに残ります)");
                  if (note !== null) act(s.id, { action: "suspend", note });
                }}
              >
                停止する
              </button>
            ) : (
              <button
                className="btn-ghost text-sm"
                disabled={busy === s.id}
                onClick={() => act(s.id, { action: "restore" })}
              >
                停止を解除
              </button>
            )}
            {s.status !== "PUBLISHED" && s.flags.length === 0 && (
              <button
                className="btn-ghost text-sm"
                disabled={busy === s.id}
                onClick={() => {
                  if (window.confirm("審査をバイパスして公開します。よろしいですか?"))
                    act(s.id, { action: "force_publish" });
                }}
              >
                強制公開
              </button>
            )}
            <button
              className="btn-ghost text-sm"
              disabled={busy === s.id}
              onClick={() =>
                act(s.id, {
                  action: "set_level",
                  level: s.contentLevel === "R15" ? "ALL_AGES" : "R15",
                })
              }
            >
              {s.contentLevel === "R15" ? "全年齢にする" : "R15にする"}
            </button>
          </div>
        </div>
      ))}
      <LoadMore nextCursor={nextCursor} onClick={loadMore} />
    </div>
  );
}
