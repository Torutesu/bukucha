"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomTab } from "@/components/BottomTab";
import { SituationCard, type CardData } from "@/components/SituationCard";

interface Persona {
  id: string;
  name: string;
  callName: string | null;
  profile: string | null;
  isDefault: boolean;
}
interface Me {
  id: string;
  nickname: string;
  personas: Persona[];
}

// SCR-014: マイページ
export default function MyPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [likes, setLikes] = useState<CardData[]>([]);
  const [editingPersona, setEditingPersona] = useState<Partial<Persona> | null>(null);
  const [editNick, setEditNick] = useState(false);
  const [nick, setNick] = useState("");

  const load = async () => {
    const r = await fetch("/api/me");
    if (r.status === 401) {
      router.replace(`/login?returnTo=${encodeURIComponent("/me")}`);
      return;
    }
    const data = await r.json();
    setMe(data);
    setNick(data.nickname);
    const lr = await fetch("/api/me/likes");
    if (lr.ok) setLikes((await lr.json()).items);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!me)
    return (
      <div className="flex min-h-dvh flex-col">
        <main className="flex-1 space-y-4 p-4">
          <div className="card h-16 animate-pulse" />
          <div className="card h-24 animate-pulse" />
        </main>
        <BottomTab />
      </div>
    );

  const savePersona = async () => {
    if (!editingPersona) return;
    const method = editingPersona.id ? "PATCH" : "POST";
    const url = editingPersona.id ? `/api/me/personas/${editingPersona.id}` : "/api/me/personas";
    await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(editingPersona),
    });
    setEditingPersona(null);
    load();
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1 space-y-6 px-4 py-5">
        <section className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-xl"
            style={{ background: "var(--c-primarySoft)", color: "var(--c-primary)" }}
          >
            {me.nickname.charAt(0)}
          </div>
          {editNick ? (
            <div className="flex flex-1 gap-2">
              <input className="input" value={nick} onChange={(e) => setNick(e.target.value)} />
              <button
                className="btn-primary px-3 text-sm"
                onClick={async () => {
                  await fetch("/api/me", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ nickname: nick }),
                  });
                  setEditNick(false);
                  load();
                }}
              >
                保存
              </button>
            </div>
          ) : (
            <>
              <p className="flex-1 text-lg font-bold">{me.nickname}</p>
              <button className="text-xs underline" style={{ color: "var(--c-textMuted)" }} onClick={() => setEditNick(true)}>
                編集
              </button>
            </>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold">── わたしの設定(ペルソナ) ──</h2>
          <div className="space-y-2">
            {me.personas.map((p) => (
              <div key={p.id} className="card flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-semibold">
                    {p.name} {p.isDefault && <span className="text-[10px]" style={{ color: "var(--c-primary)" }}>デフォルト</span>}
                  </p>
                  {p.callName && (
                    <p className="text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                      呼ばれ方: {p.callName}
                    </p>
                  )}
                </div>
                <button className="text-xs underline" onClick={() => setEditingPersona(p)}>
                  編集
                </button>
              </div>
            ))}
            <button
              className="btn-ghost w-full text-sm"
              onClick={() => setEditingPersona({ name: "", isDefault: me.personas.length === 0 })}
            >
              ＋ ペルソナを追加
            </button>
          </div>
        </section>

        {likes.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold">── いいねした物語 ──</h2>
            </div>
            <div data-testid="liked-row" className="hide-scrollbar flex gap-3 overflow-x-auto">
              {likes.map((s) => (
                <SituationCard key={s.id} s={s} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-1 text-sm">
          <h2 className="mb-1 text-sm font-bold">── その他 ──</h2>
          <Link href="/settings" className="block py-2">
            ▸ 設定
          </Link>
          <Link href="/legal/terms" className="block py-2">
            ▸ 利用規約 / プライバシー
          </Link>
          <button
            className="block py-2 text-left"
            onClick={async () => {
              if (!confirm("ログアウトしますか?")) return;
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/");
            }}
          >
            ▸ ログアウト
          </button>
        </section>
      </main>
      <BottomTab />

      {editingPersona && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6">
          <div className="card w-full max-w-sm p-4">
            <p className="text-sm font-bold">ペルソナ</p>
            <label className="label mt-3">名前(作中でのわたし)</label>
            <input
              className="input"
              value={editingPersona.name ?? ""}
              onChange={(e) => setEditingPersona({ ...editingPersona, name: e.target.value })}
            />
            <label className="label mt-3">呼ばれ方</label>
            <input
              className="input"
              value={editingPersona.callName ?? ""}
              onChange={(e) => setEditingPersona({ ...editingPersona, callName: e.target.value })}
            />
            <label className="label mt-3">設定(容姿など)</label>
            <textarea
              className="input h-20"
              value={editingPersona.profile ?? ""}
              onChange={(e) => setEditingPersona({ ...editingPersona, profile: e.target.value })}
            />
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editingPersona.isDefault ?? false}
                onChange={(e) => setEditingPersona({ ...editingPersona, isDefault: e.target.checked })}
              />
              デフォルトにする
            </label>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary flex-1 py-2 text-sm" onClick={savePersona}>
                保存
              </button>
              <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => setEditingPersona(null)}>
                やめる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
