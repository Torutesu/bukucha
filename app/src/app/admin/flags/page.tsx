"use client";

import { useState } from "react";
import Link from "next/link";
import { adminFetch, useAdminList, StatusTabs, Badge, ListState, LoadMore, fmtDate } from "../ui";

type Status = "FLAGGED" | "APPROVED" | "REJECTED";

const KIND_LABEL: Record<string, string> = {
  IP_DETECTED: "IP検出",
  CONTENT_OVER_LINE: "表現水準超過",
  BANNED_EXPRESSION: "禁止表現",
};

interface FlagRow {
  id: string;
  kind: string;
  detail: string;
  status: Status;
  reviewNote: string | null;
  createdAt: string;
  situation: {
    id: string;
    title: string;
    status: string;
    author: { id: string; nickname: string };
  } | null;
}

export default function AdminFlags() {
  const [status, setStatus] = useState<Status>("FLAGGED");
  const { items, nextCursor, error, reload, loadMore } = useAdminList<FlagRow>(
    `/api/admin/flags?status=${status}`
  );
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, next: "APPROVED" | "REJECTED") => {
    const note =
      window.prompt(next === "APPROVED" ? "誤検出として承認します。メモ(任意)" : "却下メモ(任意)") ??
      undefined;
    setBusy(id);
    try {
      await adminFetch(`/api/admin/flags/${id}`, {
        method: "POST",
        body: JSON.stringify({ status: next, note }),
      });
      await reload();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <StatusTabs
        value={status}
        onChange={setStatus}
        options={[
          { value: "FLAGGED", label: "未レビュー" },
          { value: "APPROVED", label: "誤検出" },
          { value: "REJECTED", label: "確定" },
        ]}
      />
      <p className="text-xs" style={{ color: "var(--c-textMuted)" }}>
        誤検出と判定したフラグを全て承認した作品は、作品管理から「強制公開」で公開できます
      </p>
      <ListState items={items} error={error} empty="審査フラグはありません" />
      {items?.map((f) => (
        <div key={f.id} className="card space-y-2 p-4" data-testid="flag-row">
          <div className="flex items-center justify-between gap-2">
            <Badge tone="warn">{KIND_LABEL[f.kind] ?? f.kind}</Badge>
            <span className="text-xs" style={{ color: "var(--c-textMuted)" }}>
              {fmtDate(f.createdAt)}
            </span>
          </div>
          <p className="text-sm">{f.detail}</p>
          {f.situation && (
            <p className="text-xs">
              <Link href={`/s/${f.situation.id}`} className="underline">
                {f.situation.title || "(無題)"}
              </Link>
              <span style={{ color: "var(--c-textMuted)" }}>
                {" "}
                / {f.situation.author.nickname} / {f.situation.status}
              </span>
            </p>
          )}
          {f.reviewNote && (
            <p className="text-xs" style={{ color: "var(--c-textMuted)" }}>
              メモ: {f.reviewNote}
            </p>
          )}
          {f.status === "FLAGGED" && (
            <div className="flex gap-2 pt-1">
              <button
                className="btn-primary flex-1 !py-2 text-sm"
                disabled={busy === f.id}
                onClick={() => act(f.id, "APPROVED")}
              >
                誤検出として承認
              </button>
              <button
                className="btn-ghost flex-1 text-sm"
                disabled={busy === f.id}
                onClick={() => act(f.id, "REJECTED")}
              >
                検出は正当
              </button>
            </div>
          )}
        </div>
      ))}
      <LoadMore nextCursor={nextCursor} onClick={loadMore} />
    </div>
  );
}
