"use client";

import { useState } from "react";
import Link from "next/link";
import { adminFetch, useAdminList, StatusTabs, Badge, ListState, LoadMore, fmtDate } from "../ui";

type Status = "OPEN" | "RESOLVED" | "DISMISSED";

interface ReportRow {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  detail: string | null;
  status: Status;
  resolutionNote: string | null;
  createdAt: string;
  reporter: { id: string; nickname: string };
  targetSituation: { id: string; title: string; status: string } | null;
}

export default function AdminReports() {
  const [status, setStatus] = useState<Status>("OPEN");
  const { items, nextCursor, error, reload, loadMore } = useAdminList<ReportRow>(
    `/api/admin/reports?status=${status}`
  );
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (id: string, next: "RESOLVED" | "DISMISSED") => {
    const note = window.prompt(next === "RESOLVED" ? "対応メモ(任意)" : "却下理由(任意)") ?? undefined;
    setBusy(id);
    try {
      await adminFetch(`/api/admin/reports/${id}`, {
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
          { value: "OPEN", label: "未対応" },
          { value: "RESOLVED", label: "対応済み" },
          { value: "DISMISSED", label: "却下" },
        ]}
      />
      <ListState items={items} error={error} empty="通報はありません" />
      {items?.map((r) => (
        <div key={r.id} className="card space-y-2 p-4" data-testid="report-row">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold">{r.reason}</span>
            <span className="text-xs" style={{ color: "var(--c-textMuted)" }}>
              {fmtDate(r.createdAt)}
            </span>
          </div>
          {r.detail && <p className="text-sm whitespace-pre-wrap">{r.detail}</p>}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge>{r.targetType}</Badge>
            {r.targetSituation ? (
              <Link href={`/s/${r.targetSituation.id}`} className="underline">
                {r.targetSituation.title || "(無題)"}
              </Link>
            ) : (
              <span style={{ color: "var(--c-textMuted)" }}>{r.targetId}</span>
            )}
            {r.targetSituation?.status === "SUSPENDED" && <Badge tone="warn">停止中</Badge>}
            <span style={{ color: "var(--c-textMuted)" }}>通報者: {r.reporter.nickname}</span>
          </div>
          {r.resolutionNote && (
            <p className="text-xs" style={{ color: "var(--c-textMuted)" }}>
              メモ: {r.resolutionNote}
            </p>
          )}
          {r.status === "OPEN" && (
            <div className="flex gap-2 pt-1">
              <button
                className="btn-primary flex-1 !py-2 text-sm"
                disabled={busy === r.id}
                onClick={() => act(r.id, "RESOLVED")}
              >
                対応済みにする
              </button>
              <button
                className="btn-ghost flex-1 text-sm"
                disabled={busy === r.id}
                onClick={() => act(r.id, "DISMISSED")}
              >
                却下
              </button>
            </div>
          )}
        </div>
      ))}
      <LoadMore nextCursor={nextCursor} onClick={loadMore} />
    </div>
  );
}
