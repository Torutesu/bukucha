"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { brand } from "@/lib/theme";

// 同意項目(Zeta型: 必須2+任意1)
const TERM_ITEMS = [
  { key: "tos", label: "サービス利用規約への同意", required: true, href: "/legal/terms" },
  { key: "privacy", label: "個人情報の収集及び利用への同意", required: true, href: "/legal/privacy" },
  { key: "marketing", label: "マーケティング情報・お知らせの受信", required: false, href: null },
] as const;

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
  // アカウント登録ステップ(新規ユーザーのみ): 名前入力→規約同意シート
  const [registerStep, setRegisterStep] = useState(false);
  const [name, setName] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const oauthEnabled = false; // [build-notes] OAuthはP1(env設定時に有効化)

  const allChecked = TERM_ITEMS.every((t) => checks[t.key]);
  const requiredChecked = TERM_ITEMS.filter((t) => t.required).every((t) => checks[t.key]);

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
    const u = await r.json();
    if (u.isNew) {
      setName("");
      setRegisterStep(true);
      return;
    }
    await finishLogin();
  };

  const agreeAndRegister = async () => {
    setLoading(true);
    try {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: name.trim(), agreeTerms: true }),
      });
      // 入力した名前をデフォルトのトークプロフィール(ペルソナ)にする
      await fetch("/api/me/personas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), callName: name.trim(), isDefault: true }),
      }).catch(() => {});
      await finishLogin();
    } finally {
      setLoading(false);
    }
  };

  // ===== アカウント登録ステップ =====
  if (registerStep) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[var(--shell-max)] flex-col px-6">
        <header className="flex h-14 items-center justify-center">
          <h1 className="text-base font-bold">アカウント登録</h1>
        </header>

        <div className="mt-6 flex-1">
          <p className="text-lg font-bold leading-relaxed">
            キャラクターに呼んでほしい
            <br />
            名前を教えてください
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--c-textMuted)" }}>
            トーク中にキャラクターがこの名前であなたを呼びます。あとから変更できます。
          </p>
          <input
            className="input mt-6"
            placeholder="キャラクターに呼んで欲しい名前"
            maxLength={20}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <p className="mt-1 text-right text-[11px]" style={{ color: "var(--c-textMuted)" }}>
            {name.length}/20
          </p>
        </div>

        <div className="pb-8 pt-3">
          <button
            className="btn-primary w-full"
            disabled={!name.trim() || loading}
            onClick={() => setTermsOpen(true)}
          >
            次へ
          </button>
        </div>

        {termsOpen && (
          <div className="backdrop fixed inset-0 z-40 flex items-end bg-black/50" onClick={() => setTermsOpen(false)}>
            <div
              className="card sheet-up mx-auto w-full max-w-[var(--shell-max)] rounded-b-none p-5 pb-8"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-base font-bold">Bukuchaのご利用にあたって</p>
              <p className="mt-1 text-xs" style={{ color: "var(--c-textMuted)" }}>
                サービスの利用には以下への同意が必要です
              </p>

              <button
                className="mt-4 flex w-full items-center gap-3 rounded-[12px] px-3 py-3"
                style={{ background: "var(--c-primarySoft)" }}
                onClick={() =>
                  setChecks(Object.fromEntries(TERM_ITEMS.map((t) => [t.key, !allChecked])))
                }
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full border"
                  style={{
                    background: allChecked ? "var(--c-primary)" : "transparent",
                    borderColor: allChecked ? "var(--c-primary)" : "var(--c-border)",
                    color: "#fff",
                  }}
                >
                  <Check size={13} strokeWidth={3} />
                </span>
                <span className="text-sm font-bold">すべて同意する</span>
              </button>

              <div className="mt-2 space-y-1">
                {TERM_ITEMS.map((t) => (
                  <div key={t.key} className="flex items-center gap-3 px-3 py-2">
                    <button
                      aria-label={`${t.label}に同意`}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        background: checks[t.key] ? "var(--c-primary)" : "transparent",
                        borderColor: checks[t.key] ? "var(--c-primary)" : "var(--c-border)",
                        color: "#fff",
                      }}
                      onClick={() => setChecks((c) => ({ ...c, [t.key]: !c[t.key] }))}
                    >
                      <Check size={13} strokeWidth={3} />
                    </button>
                    <span className="flex-1 text-sm">
                      <span className="mr-1 text-xs font-semibold" style={{ color: t.required ? "var(--c-primary)" : "var(--c-textMuted)" }}>
                        [{t.required ? "必須" : "任意"}]
                      </span>
                      {t.label}
                    </span>
                    {t.href && (
                      <Link href={t.href} target="_blank" aria-label={`${t.label}の全文を読む`}>
                        <ChevronRight size={16} style={{ color: "var(--c-textMuted)" }} />
                      </Link>
                    )}
                  </div>
                ))}
              </div>

              <p className="mt-3 px-3 text-[11px] leading-relaxed" style={{ color: "var(--c-textMuted)" }}>
                任意項目に同意しなくてもサービスは利用できます。同意状況はマイページからいつでも変更できます。
              </p>

              <button
                className="btn-primary mt-4 w-full"
                disabled={!requiredChecked || loading}
                onClick={agreeAndRegister}
              >
                {loading ? "…" : "同意する"}
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

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
        <Link href="/legal/terms" className="underline">
          利用規約
        </Link>
        と
        <Link href="/legal/privacy" className="underline">
          プライバシーポリシー
        </Link>
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
