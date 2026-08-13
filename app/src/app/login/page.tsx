"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BookHeart, Check, ChevronRight, Feather, Mail, MessageCircleHeart } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/Logo";
import { brand } from "@/lib/theme";

// 同意項目(必須2 + 任意1)
const TERM_ITEMS = [
  { key: "tos", label: "サービス利用規約への同意", required: true, href: "/legal/terms" },
  { key: "privacy", label: "個人情報の収集及び利用への同意", required: true, href: "/legal/privacy" },
  { key: "marketing", label: "マーケティング情報・お知らせの受信", required: false, href: null },
] as const;

/** SNSのブランドマーク(公式配色。連携自体は未接続) */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M45 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12c-.2 2-1.5 5-4.4 7l6.7 5.2c4-3.7 6.7-9.1 6.7-15.5z" />
      <path fill="#34A853" d="M24 46c5.8 0 10.7-1.9 14.3-5.2l-6.7-5.2c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.900l-7 5.4C8.1 40.6 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 27.9c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4l-7-5.4C3.3 16.6 2.5 20.2 2.5 23.5s.8 6.9 2 9.8l7-5.4z" />
      <path fill="#EA4335" d="M24 10.4c3.2 0 5.4 1.4 6.6 2.5l5.9-5.8C32.9 3.8 28 2 24 2 15.4 2 8.1 7.4 4.5 13.7l7 5.4C13.3 14.2 18.2 10.4 24 10.4z" />
    </svg>
  );
}
function AppleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.7c0-2.4 2-3.6 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.2 1.7 2.5 3 2.4 1.2 0 1.6-.8 3.1-.8 1.4 0 1.8.8 3.1.7 1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.5-1-2.5-3.8zM14 5.4c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z" />
    </svg>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo") ?? "/";
  const isGuestMigration = returnTo.includes("/story/guest");
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // アカウント登録ステップ(新規ユーザーのみ): 名前入力→規約同意シート
  const [registerStep, setRegisterStep] = useState(false);
  const [name, setName] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);
  const [checks, setChecks] = useState<Record<string, boolean>>({});

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

  const login = async (body: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j?.error?.message ?? "ログインできませんでした。時間をおいて試してください");
        return;
      }
      const u = await r.json();
      if (u.isNew) {
        setName("");
        setRegisterStep(true);
        return;
      }
      await finishLogin();
    } catch {
      setError("通信に失敗しました。電波の良い場所で試してください");
    } finally {
      setLoading(false);
    }
  };

  /** SNS連携は未接続のため、端末ごとの仮アカウントで開始する */
  const startWithProvider = async (provider: "google" | "apple") => {
    let key = localStorage.getItem("bukucha_device_key");
    if (!key) {
      key = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem("bukucha_device_key", key);
    }
    await login({ email: `${provider}-${key}@device.bukucha.app`, provider });
  };

  // ===== アカウント登録ステップ =====
  if (registerStep) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[var(--shell-max)] flex-col px-6">
        <header className="relative flex h-14 items-center justify-center">
          <button
            aria-label="戻る"
            className="icon-btn absolute left-0"
            onClick={() => setRegisterStep(false)}
          >
            <ArrowLeft size={20} />
          </button>
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
              <p className="text-base font-bold">{brand.name}のご利用にあたって</p>
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
                      <span
                        className="mr-1 text-xs font-semibold"
                        style={{ color: t.required ? "var(--c-primary)" : "var(--c-textMuted)" }}
                      >
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
                onClick={async () => {
                  setLoading(true);
                  try {
                    await fetch("/api/me", {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ nickname: name.trim(), agreeTerms: true }),
                    });
                    await fetch("/api/me/personas", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ name: name.trim(), callName: name.trim(), isDefault: true }),
                    }).catch(() => {});
                    await finishLogin();
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {loading ? "…" : "同意する"}
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

  // ===== ログイン =====
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[var(--shell-max)] flex-col px-7">
      {/* ブランドヒーロー */}
      <div className="flex flex-1 flex-col items-center justify-center pt-10">
        <span
          className="flex h-24 w-24 items-center justify-center rounded-[26px]"
          style={{
            background: "linear-gradient(140deg, var(--c-primarySoft), var(--c-surface))",
            boxShadow: "0 12px 32px -18px var(--c-primary)",
          }}
        >
          <LogoMark size={54} />
        </span>
        <div className="mt-5">
          <Wordmark size="1.7rem" />
        </div>
        <p className="mt-2 text-center text-sm" style={{ color: "var(--c-textMuted)" }}>
          {isGuestMigration ? "ここまでの物語を保存して、続きを読もう" : brand.tagline}
        </p>

        <ul className="mt-9 w-full space-y-3">
          {[
            { Icon: BookHeart, text: "気になるシチュを選ぶだけで物語がはじまる" },
            { Icon: MessageCircleHeart, text: "あなたの一言で、彼の反応も展開も変わる" },
            { Icon: Feather, text: "自分の妄想からプロットを作って公開できる" },
          ].map(({ Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--c-primarySoft)", color: "var(--c-primary)" }}
              >
                <Icon size={17} strokeWidth={1.9} />
              </span>
              <span className="text-[13px]">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ログイン手段 */}
      <div className="space-y-2.5 pb-4">
        {!emailMode ? (
          <>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-input)] border py-3 text-sm font-semibold"
              style={{ borderColor: "var(--c-border)", background: "var(--c-surface)" }}
              disabled={loading}
              onClick={() => startWithProvider("google")}
            >
              <GoogleMark /> Googleではじめる
            </button>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-input)] py-3 text-sm font-semibold"
              style={{ background: "var(--c-text)", color: "var(--c-bg)" }}
              disabled={loading}
              onClick={() => startWithProvider("apple")}
            >
              <AppleMark /> Appleではじめる
            </button>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-input)] border py-3 text-sm font-semibold"
              style={{ borderColor: "var(--c-border)" }}
              onClick={() => setEmailMode(true)}
            >
              <Mail size={17} /> メールではじめる
            </button>
          </>
        ) : (
          <div className="space-y-2.5">
            <label className="label" htmlFor="login-email">
              メールアドレス
            </label>
            <input
              id="login-email"
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && email && login({ email })}
              autoFocus
            />
            <button
              className="btn-primary w-full"
              onClick={() => login({ email })}
              disabled={loading || !email}
            >
              {loading ? "…" : "ログイン"}
            </button>
            <button
              className="w-full py-1 text-center text-xs"
              style={{ color: "var(--c-textMuted)" }}
              onClick={() => {
                setEmailMode(false);
                setError(null);
              }}
            >
              ほかの方法でログイン
            </button>
          </div>
        )}

        {error && (
          <p data-testid="login-error" className="text-center text-xs" style={{ color: "var(--c-danger)" }}>
            {error}
          </p>
        )}

        <p className="pt-2 text-center text-[11px] leading-relaxed" style={{ color: "var(--c-textMuted)" }}>
          はじめると
          <Link href="/legal/terms" className="underline">
            利用規約
          </Link>
          と
          <Link href="/legal/privacy" className="underline">
            プライバシーポリシー
          </Link>
          に同意したものとみなされます
          <br />
          <span className="opacity-80">※ SNS連携は準備中です。この端末の仮アカウントで開始します</span>
        </p>
      </div>
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
