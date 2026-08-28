"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface PlanSpec {
  id: "FREE" | "READER" | "AUTHOR";
  name: string;
  priceCents: number;
  webPriceCents: number;
  cinematic: number;
  blurb: string;
  perks: string[];
}

interface Me {
  birthDate: string | null;
  matureOptIn: boolean;
  isAdult: boolean;
  email: string | null;
  plan: "FREE" | "READER" | "AUTHOR";
  quota: { cinematicLeft: number; cinematicLimit: number; resetsAt: string };
  plans: PlanSpec[];
}

const money = (cents: number) => (cents === 0 ? "Free" : `$${(cents / 100).toFixed(2)}`);

// SCR-018 settings, with SCR-015 plans inline.
export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [theme, setTheme] = useState("system");
  const [birthInput, setBirthInput] = useState("");
  const [confirmBirth, setConfirmBirth] = useState(false);
  const [matureModal, setMatureModal] = useState(false);
  const [matureAck, setMatureAck] = useState(false);

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
      setTheme(localStorage.getItem("hc_theme") ?? "system");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem("hc_theme", t);
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

  const toggleMature = async () => {
    if (!me) return;
    if (me.matureOptIn) {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matureOptIn: false }),
      });
      load();
    } else {
      setMatureModal(true);
    }
  };

  const confirmMature = async () => {
    await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matureOptIn: true }),
    });
    setMatureModal(false);
    setMatureAck(false);
    load();
  };

  if (!me) return <main className="p-8 text-center text-sm">Loading…</main>;

  const canToggle = me.isAdult;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-2 px-4 py-3">
        <button aria-label="Back" onClick={() => router.back()}>
          ←
        </button>
        <h1 className="text-lg font-bold">Settings</h1>
      </header>

      <main className="flex-1 space-y-6 px-4 py-2">
        {/* SCR-015. Standard turns are unlimited on every plan, so this page
            reports what is left of the Cinematic allowance and nothing else. */}
        <section>
          <h2 className="label">Plan</h2>
          <div className="card p-4">
            <p className="text-sm">
              You are on <span className="font-bold">{me.plans.find((p) => p.id === me.plan)?.name}</span>.
              Standard turns are unlimited.
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--c-textMuted)" }}>
              Cinematic: {me.quota.cinematicLeft} of {me.quota.cinematicLimit} left · resets{" "}
              {new Date(me.quota.resetsAt).toLocaleDateString("en-US")}
            </p>
            <div className="mt-3 space-y-2">
              {me.plans.map((p) => (
                <div
                  key={p.id}
                  data-testid={`plan-${p.id}`}
                  className="rounded-lg p-3"
                  style={{
                    background: p.id === me.plan ? "var(--c-primarySoft)" : "var(--c-surfaceAlt)",
                  }}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold">{p.name}</span>
                    <span className="text-sm">
                      {money(p.priceCents)}
                      {p.priceCents > 0 && (
                        <span className="ml-1 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                          / mo · {money(p.webPriceCents)} on the web
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                    {p.blurb}
                  </p>
                  <ul className="mt-1.5 space-y-0.5">
                    {p.perks.map((perk) => (
                      <li key={perk} className="text-[11px]">
                        · {perk}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
              Editing your Canon is free on every plan, forever. You should never pay to correct
              something the story got wrong.
            </p>
          </div>
        </section>

        <section>
          <h2 className="label">Appearance</h2>
          <div className="flex gap-2">
            {[
              { v: "system", l: "System" },
              { v: "light", l: "Light" },
              { v: "dark", l: "Dark" },
            ].map((t) => (
              <button
                key={t.v}
                className="chip"
                data-on={theme === t.v}
                onClick={() => applyTheme(t.v)}
              >
                {t.l}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="label">Content</h2>
          <div className="card space-y-4 p-4">
            <div>
              <label htmlFor="birth" className="label">
                Date of birth
              </label>
              {me.birthDate ? (
                <p className="text-sm">
                  {new Date(me.birthDate).toLocaleDateString("en-US")} (cannot be changed)
                </p>
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
                    Confirm
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Mature stories</p>
                <p className="max-w-[220px] text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                  Turn this on to see stories with charged, suggestive writing. Explicit content is
                  not published here at all.
                </p>
                {!canToggle && (
                  <p className="mt-1 text-[11px]" style={{ color: "var(--c-danger)" }}>
                    Unlocks at 18.
                  </p>
                )}
              </div>
              <button
                data-testid="mature-toggle"
                aria-label="Mature stories"
                disabled={!canToggle}
                onClick={toggleMature}
                className="relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40"
                style={{ background: me.matureOptIn ? "var(--c-primary)" : "var(--c-border)" }}
              >
                <span
                  className="absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all"
                  style={{ left: me.matureOptIn ? "22px" : "2px" }}
                />
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="label">Account</h2>
          <div className="card p-4 text-sm">
            <p style={{ color: "var(--c-textMuted)" }}>{me.email ?? "No email on file"}</p>
            <button
              className="mt-3 text-xs"
              style={{ color: "var(--c-danger)" }}
              onClick={async () => {
                if (!confirm("Delete your account?")) return;
                if (!confirm("Your published stories will be unpublished. Continue?")) return;
                await fetch("/api/me", { method: "DELETE" });
                router.push("/");
              }}
            >
              Delete account
            </button>
          </div>
        </section>
      </main>

      {confirmBirth && (
        <div
          data-testid="birth-confirm-modal"
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6"
        >
          <div className="card w-full max-w-sm p-4">
            <p className="text-sm">
              Make sure this is right. Your date of birth cannot be changed afterwards.
            </p>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary flex-1 py-2 text-sm" onClick={saveBirth}>
                Confirm
              </button>
              <button
                className="btn-ghost flex-1 py-2 text-sm"
                onClick={() => setConfirmBirth(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {matureModal && (
        <div
          data-testid="mature-confirm-modal"
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6"
        >
          <div className="card w-full max-w-sm p-4">
            <p className="text-sm font-bold">Show mature stories?</p>
            <p className="mt-2 text-xs" style={{ color: "var(--c-textMuted)" }}>
              Stories rated 18+ contain charged, suggestive writing. They are never explicit.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={matureAck}
                onChange={(e) => setMatureAck(e.target.checked)}
              />
              I am 18 or older
            </label>
            <div className="mt-3 flex gap-2">
              <button
                className="btn-primary flex-1 py-2 text-sm disabled:opacity-40"
                disabled={!matureAck}
                onClick={confirmMature}
              >
                Turn on
              </button>
              <button
                className="btn-ghost flex-1 py-2 text-sm"
                onClick={() => setMatureModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
