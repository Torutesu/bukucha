"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Plus } from "lucide-react";

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
  handle: string | null;
  bio: string | null;
  avatarUrl: string | null;
  personas: Persona[];
}

// SCR-014b: プロフィール編集(Zeta型: ソーシャル/トーク用タブ)
export default function ProfileEditPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"social" | "talk">("social");
  const [me, setMe] = useState<Me | null>(null);
  const [nickname, setNickname] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editingPersona, setEditingPersona] = useState<Partial<Persona> | null>(null);

  const loadPersonas = async () => {
    const r = await fetch("/api/me");
    if (r.ok) {
      const d = await r.json();
      setMe((m) => (m ? { ...m, personas: d.personas } : d));
    }
  };

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/me");
      if (r.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent("/me/edit")}`);
        return;
      }
      const d = await r.json();
      setMe(d);
      setNickname(d.nickname);
      setHandle(d.handle ?? "");
      setBio(d.bio ?? "");
      setAvatarUrl(d.avatarUrl);
    })();
  }, [router]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const uploadAvatar = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const r = await fetch("/api/uploads", { method: "POST", body: form });
    if (!r.ok) {
      notify("アップロードに失敗しました");
      return;
    }
    const { url } = await r.json();
    setAvatarUrl(url);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = { nickname, bio, avatarUrl };
    if (handle.trim()) body.handle = handle.trim();
    const r = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.message ?? "保存に失敗しました");
      return;
    }
    notify("保存しました");
    setTimeout(() => router.push("/me"), 600);
  };

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
    loadPersonas();
  };

  if (!me)
    return (
      <main className="space-y-4 p-4">
        <div className="card h-40 animate-pulse" />
      </main>
    );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-12 items-center justify-between px-2">
        <button aria-label="戻る" className="icon-btn" onClick={() => router.push("/me")}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-bold">プロフィール編集</h1>
        {tab === "social" ? (
          <button
            className="px-3 text-sm font-bold"
            style={{ color: "var(--c-primary)" }}
            disabled={saving || !nickname.trim()}
            onClick={save}
          >
            {saving ? "…" : "保存"}
          </button>
        ) : (
          <span className="w-12" />
        )}
      </header>

      <div className="flex border-b" style={{ borderColor: "var(--c-border)" }}>
        {(
          [
            ["social", "ソーシャルプロフィール"],
            ["talk", "トーク用"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            className="flex-1 py-2.5 text-sm font-semibold"
            style={{
              color: tab === k ? "var(--c-text)" : "var(--c-textMuted)",
              boxShadow: tab === k ? "inset 0 -2px 0 var(--c-primary)" : "none",
            }}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "social" ? (
        <main className="flex-1 space-y-5 px-4 py-5">
          <div className="flex justify-center">
            <button className="relative" aria-label="アバターを変更" onClick={() => fileRef.current?.click()}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <span
                  className="flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold"
                  style={{ background: "var(--c-primarySoft)", color: "var(--c-primary)" }}
                >
                  {nickname.charAt(0) || "?"}
                </span>
              )}
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2"
                style={{ background: "var(--c-surface)", borderColor: "var(--c-bg)" }}
              >
                <Pencil size={13} />
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
          </div>

          <div>
            <label className="label">クリエイター名</label>
            <input
              className="input"
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <div>
            <label className="label">ID</label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                style={{ color: "var(--c-textMuted)" }}
              >
                @
              </span>
              <input
                className="input pl-7"
                placeholder={`user_${me.id.slice(-8)}`}
                maxLength={20}
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
              />
            </div>
            <p className="mt-1 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
              3〜20文字の英数字・_・.が使えます
            </p>
          </div>

          <div>
            <label className="label">プロフィール</label>
            <textarea
              className="input h-24"
              maxLength={100}
              placeholder="自己紹介を書いてみましょう"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <p className="mt-1 text-right text-[11px]" style={{ color: "var(--c-textMuted)" }}>
              {bio.length}/100
            </p>
          </div>

          {error && (
            <p className="text-xs" style={{ color: "var(--c-danger)" }}>
              {error}
            </p>
          )}
        </main>
      ) : (
        <main className="flex-1 space-y-3 px-4 py-5">
          <p className="text-xs" style={{ color: "var(--c-textMuted)" }}>
            トーク中の「わたし」の設定です。キャラクターはこのプロフィールであなたを認識します。
          </p>
          {me.personas.map((p) => (
            <button
              key={p.id}
              className="card flex w-full items-center justify-between p-3 text-left"
              onClick={() => setEditingPersona(p)}
            >
              <span>
                <span className="block text-sm font-semibold">
                  {p.name}{" "}
                  {p.isDefault && (
                    <span
                      className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: "var(--c-primarySoft)", color: "var(--c-primary)" }}
                    >
                      デフォルト
                    </span>
                  )}
                </span>
                {p.callName && (
                  <span className="block text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                    呼ばれ方: {p.callName}
                  </span>
                )}
              </span>
              <Pencil size={14} style={{ color: "var(--c-textMuted)" }} />
            </button>
          ))}
          <button
            className="btn-ghost w-full text-sm"
            onClick={() => setEditingPersona({ name: "", isDefault: me.personas.length === 0 })}
          >
            <Plus size={15} className="mr-1 inline align-[-2px]" /> トークプロフィール追加
          </button>
        </main>
      )}

      {editingPersona && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6">
          <div className="card modal-pop w-full max-w-sm p-4">
            <p className="text-sm font-bold">トークプロフィール</p>
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

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex justify-center">
          <span className="rounded-full bg-black/80 px-4 py-2 text-xs text-white">{toast}</span>
        </div>
      )}
    </div>
  );
}
