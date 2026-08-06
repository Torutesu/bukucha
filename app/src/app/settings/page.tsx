"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Me {
  birthDate: string | null;
  safeFilterOff: boolean;
  isAdult: boolean;
  email: string | null;
}

// SCR-018: 設定(年齢確認・安心フィルター)
export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [theme, setTheme] = useState("system");
  const [birthInput, setBirthInput] = useState("");
  const [confirmBirth, setConfirmBirth] = useState(false);
  const [filterModal, setFilterModal] = useState(false);
  const [filterAck, setFilterAck] = useState(false);

  const load = async () => {
    const r = await fetch("/api/me");
    if (r.status === 401) {
      router.replace(`/login?returnTo=${encodeURIComponent("/settings")}`);
      return;
    }
    setMe(await r.json());
  };

  useEffect(() => {
    (async () => {
      await load();
      setTheme(localStorage.getItem("bukucha_theme") ?? "system");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem("bukucha_theme", t);
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  };

  const saveBirth = async () => {
    const r = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ birthDate: birthInput }),
    });
    setConfirmBirth(false);
    if (r.ok) load();
  };

  const toggleFilter = async () => {
    if (!me) return;
    if (me.safeFilterOff) {
      // ONに戻す(確認なし)
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ safeFilterOff: false }),
      });
      load();
    } else {
      setFilterModal(true);
    }
  };

  const confirmFilterOff = async () => {
    await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ safeFilterOff: true }),
    });
    setFilterModal(false);
    setFilterAck(false);
    load();
  };

  if (!me) return <main className="p-8 text-center text-sm">読み込み中…</main>;

  const canToggle = me.isAdult;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-2 px-4 py-3">
        <button aria-label="戻る" onClick={() => router.back()}>
          ←
        </button>
        <h1 className="text-lg font-bold">設定</h1>
      </header>

      <main className="flex-1 space-y-6 px-4 py-2">
        <section>
          <h2 className="label">表示</h2>
          <div className="flex gap-2">
            {[
              { v: "system", l: "システム" },
              { v: "light", l: "ライト" },
              { v: "dark", l: "ダーク" },
            ].map((t) => (
              <button key={t.v} className="chip" data-on={theme === t.v} onClick={() => applyTheme(t.v)}>
                {t.l}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="label">コンテンツ</h2>
          <div className="card space-y-4 p-4">
            <div>
              <label htmlFor="birth" className="label">
                生年月日
              </label>
              {me.birthDate ? (
                <p className="text-sm">{new Date(me.birthDate).toLocaleDateString("ja-JP")}(変更できません)</p>
              ) : (
                <div className="flex gap-2">
                  <input
                    id="birth"
                    type="date"
                    className="input"
                    value={birthInput}
                    onChange={(e) => setBirthInput(e.target.value)}
                  />
                  <button
                    className="btn-primary whitespace-nowrap px-3 text-sm"
                    disabled={!birthInput}
                    onClick={() => setConfirmBirth(true)}
                  >
                    生年月日を確定
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">安心フィルター</p>
                <p className="max-w-[200px] text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                  OFFにすると、大人向けのセンシティブな表現を含む物語が表示されます
                </p>
                {!canToggle && (
                  <p className="mt-1 text-[11px]" style={{ color: "var(--c-danger)" }}>
                    18歳になったら解除できます
                  </p>
                )}
              </div>
              <button
                data-testid="safe-filter-toggle"
                disabled={!canToggle}
                onClick={toggleFilter}
                className="relative h-7 w-12 rounded-full transition disabled:opacity-40"
                style={{ background: me.safeFilterOff ? "var(--c-primary)" : "var(--c-border)" }}
              >
                <span
                  className="absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all"
                  style={{ left: me.safeFilterOff ? "22px" : "2px" }}
                />
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="label">アカウント</h2>
          <div className="card p-4 text-sm">
            <p style={{ color: "var(--c-textMuted)" }}>{me.email ?? "メール未設定"}</p>
            <button
              className="mt-3 text-xs"
              style={{ color: "var(--c-danger)" }}
              onClick={async () => {
                if (!confirm("本当に退会しますか?")) return;
                if (!confirm("退会すると作品も非公開になります。よろしいですか?")) return;
                await fetch("/api/me", { method: "DELETE" });
                router.push("/");
              }}
            >
              退会する
            </button>
          </div>
        </section>
      </main>

      {confirmBirth && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6">
          <div className="card w-full max-w-sm p-4">
            <p className="text-sm">正しい生年月日を入力してください。あとから変更できません。</p>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary flex-1 py-2 text-sm" onClick={saveBirth}>
                確定する
              </button>
              <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => setConfirmBirth(false)}>
                やめる
              </button>
            </div>
          </div>
        </div>
      )}

      {filterModal && (
        <div data-testid="filter-confirm-modal" className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6">
          <div className="card w-full max-w-sm p-4">
            <p className="text-sm font-bold">安心フィルターをOFFにしますか?</p>
            <p className="mt-2 text-xs" style={{ color: "var(--c-textMuted)" }}>
              大人向けのセンシティブな表現を含む物語が表示されるようになります。
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={filterAck} onChange={(e) => setFilterAck(e.target.checked)} />
              私は18歳以上です
            </label>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary flex-1 py-2 text-sm disabled:opacity-40" disabled={!filterAck} onClick={confirmFilterOff}>
                OFFにする
              </button>
              <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => setFilterModal(false)}>
                やめる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
