"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { brand } from "@/lib/theme";

// SCR-017: ログイン/登録
function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo") ?? "/";
  const isGuestMigration = returnTo.includes("/story/guest");
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const oauthEnabled = false; // [build-notes] OAuthはP1(env設定時に有効化)

  const finishLogin = async () => {
    // ゲストStory引き継ぎ(E2E-002)
    const guestRaw = localStorage.getItem("bukucha_guest_story");
    let target = returnTo;
    if (guestRaw) {
      try {
        const g = JSON.parse(guestRaw);
        const r = await fetch("/api/stories/migrate-guest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            guestStory: {
              situationId: g.situationId,
              introVariantId: g.introVariantId,
              messages: g.messages,
            },
          }),
        });
        if (r.ok) {
          const story = await r.json();
          localStorage.removeItem("bukucha_guest_story");
          target = `/story/${story.id}`;
        }
      } catch {
        /* ignore */
      }
    }
    // 嗜好タグを保存
    const pref = localStorage.getItem("bukucha_pref_tags");
    if (pref) {
      try {
        await fetch("/api/me", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ preferenceTags: JSON.parse(pref) }),
        });
      } catch {
        /* ignore */
      }
    }
    router.push(target);
  };

  const submitEmail = async () => {
    setLoading(true);
    setError(false);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (!r.ok) {
      setError(true);
      return;
    }
    await finishLogin();
  };

  return (
    <main className="flex min-h-dvh flex-col justify-center px-8">
      <h1 className="text-center text-3xl font-bold" style={{ color: "var(--c-primary)" }}>
        {brand.name}
      </h1>
      <p className="mt-3 text-center text-sm" style={{ color: "var(--c-textMuted)" }}>
        {isGuestMigration ? "ここまでの物語を保存して、続きを読もう" : "物語のつづきを、保存しよう"}
      </p>

      <div className="mt-8 space-y-3">
        <button className="btn-ghost w-full" disabled={!oauthEnabled} title={oauthEnabled ? "" : "準備中"}>
           Googleでつづける
        </button>
        <button className="btn-ghost w-full" disabled={!oauthEnabled} title={oauthEnabled ? "" : "準備中"}>
           Appleでつづける
        </button>

        {!emailMode ? (
          <button className="btn-primary w-full" onClick={() => setEmailMode(true)}>
            メールでつづける
          </button>
        ) : (
          <div className="space-y-2">
            <input
              className="input"
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="text-xs" style={{ color: "var(--c-danger)" }}>ログインに失敗しました</p>}
            <button className="btn-primary w-full" onClick={submitEmail} disabled={loading || !email}>
              {loading ? "…" : "ログイン"}
            </button>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-[11px]" style={{ color: "var(--c-textMuted)" }}>
        登録すると
        <a href="/legal/terms" className="underline">
          利用規約
        </a>
        と
        <a href="/legal/privacy" className="underline">
          プライバシーポリシー
        </a>
        に同意したことになります
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
