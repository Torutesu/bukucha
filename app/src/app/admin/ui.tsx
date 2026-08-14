"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** /api/admin/* 用の小さなfetchユーティリティとリスト部品。ロジックは全てサーバー側 */

export async function adminFetch(path: string, init?: RequestInit) {
  const r = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data?.error?.message ?? "エラー"), { status: r.status });
  return data;
}

/** カーソルページング付きリスト取得。pathが変わったら取得済みデータは無効(=ローディング表示) */
export function useAdminList<T>(path: string) {
  const [data, setData] = useState<{ key: string; items: T[]; nextCursor: string | null } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const pathRef = useRef(path);

  const load = useCallback(async () => {
    try {
      const d = await adminFetch(path);
      if (pathRef.current !== path) return; // 古いパスへの応答は破棄(検索直後の競合対策)
      setData({ key: path, items: d.items, nextCursor: d.nextCursor });
      setError(null);
    } catch (e) {
      if (pathRef.current === path) setError((e as Error).message);
    }
  }, [path]);

  useEffect(() => {
    pathRef.current = path;
    (async () => {
      await load();
    })();
  }, [path, load]);

  const current = data?.key === path ? data : null;

  const loadMore = async () => {
    if (!current?.nextCursor) return;
    const sep = path.includes("?") ? "&" : "?";
    const d = await adminFetch(`${path}${sep}cursor=${current.nextCursor}`);
    setData({ key: path, items: [...current.items, ...d.items], nextCursor: d.nextCursor });
  };

  return {
    items: current?.items ?? null,
    nextCursor: current?.nextCursor ?? null,
    error,
    reload: load,
    loadMore,
  };
}

export function StatusTabs<T extends string>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {props.options.map((o) => (
        <button
          key={o.value}
          className="chip"
          data-on={props.value === o.value}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "warn" | "ok" }) {
  const color =
    tone === "warn" ? "var(--c-danger, #c0392b)" : tone === "ok" ? "var(--c-primary)" : "var(--c-textMuted)";
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[11px]"
      style={{ border: `1px solid ${color}`, color }}
    >
      {children}
    </span>
  );
}

export function ListState(props: {
  items: unknown[] | null;
  error: string | null;
  empty: string;
}) {
  if (props.error) return <p className="text-sm text-red-600">{props.error}</p>;
  if (props.items === null) return <div className="card h-20 animate-pulse" />;
  if (props.items.length === 0)
    return <p className="py-8 text-center text-sm" style={{ color: "var(--c-textMuted)" }}>{props.empty}</p>;
  return null;
}

export function LoadMore(props: { nextCursor: string | null; onClick: () => void }) {
  if (!props.nextCursor) return null;
  return (
    <button className="btn-ghost w-full" onClick={props.onClick}>
      さらに読み込む
    </button>
  );
}

export function fmtDate(d: string | Date) {
  return new Date(d).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });
}
