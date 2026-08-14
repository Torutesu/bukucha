"use client";

import { useAdminList, Badge, ListState, LoadMore, fmtDate } from "../ui";

interface LogRow {
  id: string;
  actorId: string;
  actorNickname: string | null;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
  createdAt: string;
}

export default function AdminAudit() {
  const { items, nextCursor, error, loadMore } = useAdminList<LogRow>("/api/admin/audit");

  return (
    <div className="space-y-3">
      <ListState items={items} error={error} empty="操作ログはまだありません" />
      {items?.map((l) => (
        <div key={l.id} className="card space-y-1 p-3" data-testid="audit-row">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge>{l.action}</Badge>
              <span className="text-xs">{l.actorNickname ?? l.actorId}</span>
            </div>
            <span className="text-xs" style={{ color: "var(--c-textMuted)" }}>
              {fmtDate(l.createdAt)}
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--c-textMuted)" }}>
            {l.targetType}:{l.targetId}
            {l.detail && ` — ${l.detail}`}
          </p>
        </div>
      ))}
      <LoadMore nextCursor={nextCursor} onClick={loadMore} />
    </div>
  );
}
