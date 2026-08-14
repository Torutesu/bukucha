"use client";

import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";
import { brand } from "@/lib/theme";

export type ThemeChoice = "system" | "light" | "dark";

const OPTIONS: { v: ThemeChoice; label: string; hint: string }[] = [
  { v: "system", label: "システム", hint: "端末の設定に合わせる" },
  { v: "light", label: "ライト", hint: "明るい紙の色" },
  { v: "dark", label: "ダーク", hint: "夜に読みやすい" },
];

// 現在のテーマはDOM(data-theme属性)が正。購読側にはこのストア経由で伝える
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
const getSnapshot = (): ThemeChoice =>
  (document.documentElement.getAttribute("data-theme") as ThemeChoice | null) ?? "system";

/** テーマを適用してlocalStorageに保存する。layout.tsxの初期化スクリプトと同じキーを使う */
export function applyTheme(t: ThemeChoice) {
  localStorage.setItem("bukucha_theme", t);
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  // ブラウザのUI(アドレスバー等)の色も合わせる
  const dark =
    t === "dark" ||
    (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? brand.colors.dark.bg : brand.colors.light.bg);
  listeners.forEach((l) => l());
}

/** 配色のミニプレビュー(実際のトークンで描く) */
function Preview({ mode }: { mode: "light" | "dark" | "system" }) {
  const c = brand.colors[mode === "dark" ? "dark" : "light"];
  const body = (p: typeof c) => (
    <>
      <span className="block h-2 w-8 rounded-full" style={{ background: p.primary }} />
      <span
        className="mt-1.5 block h-4 w-full rounded"
        style={{ background: p.surface, border: `1px solid ${p.border}` }}
      />
      <span
        className="mt-1 block h-4 w-full rounded"
        style={{ background: p.surface, border: `1px solid ${p.border}` }}
      />
    </>
  );
  if (mode === "system") {
    return (
      <span className="relative block h-[58px] w-full overflow-hidden rounded-[10px]">
        <span className="absolute inset-0 flex">
          <span className="w-1/2 p-2" style={{ background: brand.colors.light.bg }}>
            {body(brand.colors.light)}
          </span>
          <span className="w-1/2 p-2" style={{ background: brand.colors.dark.bg }}>
            {body(brand.colors.dark)}
          </span>
        </span>
      </span>
    );
  }
  return (
    <span className="block h-[58px] w-full overflow-hidden rounded-[10px] p-2" style={{ background: c.bg }}>
      {body(c)}
    </span>
  );
}

export function ThemePicker() {
  // SSRでは値を読めないため、サーバースナップショットは"system"にする
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "system" as ThemeChoice);

  return (
    <div data-testid="theme-picker" className="grid grid-cols-3 gap-2.5">
      {OPTIONS.map((o) => {
        const on = theme === o.v;
        return (
          <button
            key={o.v}
            data-testid={`theme-${o.v}`}
            data-on={on}
            aria-pressed={on}
            className="pressable rounded-[14px] border p-2 text-left"
            style={{
              borderColor: on ? "var(--c-primary)" : "var(--c-border)",
              background: "var(--c-surface)",
              boxShadow: on ? "0 4px 16px -8px var(--c-primary)" : "var(--elev-1)",
            }}
            onClick={() => applyTheme(o.v)}
          >
            <Preview mode={o.v} />
            <span className="mt-2 flex items-center gap-1">
              <span className="text-xs font-semibold">{o.label}</span>
              {on && <Check size={13} strokeWidth={3} style={{ color: "var(--c-primary)" }} />}
            </span>
            <span className="block text-[10px] leading-tight" style={{ color: "var(--c-textMuted)" }}>
              {o.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
