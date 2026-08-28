"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { brand } from "@/lib/theme";

// SCR-017: Sign in
function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo") ?? "/";
  const isGuestMigration = returnTo.includes("/play/guest");
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const oauthEnabled = false; // [build-notes] P1 — enabled once the OAuth env is set.

  const finishLogin = async () => {
    // Carry the signed-out route across so nothing the reader played is lost.
    const guestRaw = localStorage.getItem("hc_guest_route");
    let target = returnTo;
    if (guestRaw) {
      try {
        const g = JSON.parse(guestRaw);
        const r = await fetch("/api/routes/migrate-guest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            guestStory: {
              storyId: g.storyId,
              introId: g.introId,
              messages: g.messages,
            },
          }),
        });
        if (r.ok) {
          const route = await r.json();
          localStorage.removeItem("hc_guest_route");
          target = `/play/${route.id}`;
        }
      } catch {
        /* ignore */
      }
    }
    // Persist the tropes chosen during onboarding.
    const pref = localStorage.getItem("hc_pref_tags");
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
        {isGuestMigration
          ? "Save the route you just played and keep going."
          : "Keep your routes, your canon, and your endings."}
      </p>

      <div className="mt-8 space-y-3">
        <button className="btn-ghost w-full" disabled={!oauthEnabled} title={oauthEnabled ? "" : "Coming soon"}>
          Continue with Google
        </button>
        <button className="btn-ghost w-full" disabled={!oauthEnabled} title={oauthEnabled ? "" : "Coming soon"}>
          Continue with Apple
        </button>

        {!emailMode ? (
          <button className="btn-primary w-full" onClick={() => setEmailMode(true)}>
            Continue with email
          </button>
        ) : (
          <div className="space-y-2">
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="text-xs" style={{ color: "var(--c-danger)" }}>That did not work. Check the address and try again.</p>}
            <button className="btn-primary w-full" onClick={submitEmail} disabled={loading || !email}>
              {loading ? "…" : "Continue"}
            </button>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-[11px]" style={{ color: "var(--c-textMuted)" }}>
        By continuing you agree to our{" "}
        <Link href="/legal/terms" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/legal/privacy" className="underline">
          Privacy Policy
        </Link>
        .
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
