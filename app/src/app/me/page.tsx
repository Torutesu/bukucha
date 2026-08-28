"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomTab } from "@/components/BottomTab";
import { StoryCard, type CardData } from "@/components/StoryCard";

interface Persona {
  id: string;
  name: string;
  callName: string | null;
  profile: string | null;
  isDefault: boolean;
}
interface Me {
  id: string;
  displayName: string;
  personas: Persona[];
}

// SCR-014: your account
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
    setNick(data.displayName);
    const lr = await fetch("/api/me/likes");
    if (lr.ok) setLikes((await lr.json()).items);
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
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
            {me.displayName.charAt(0)}
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
                    body: JSON.stringify({ displayName: nick }),
                  });
                  setEditNick(false);
                  load();
                }}
              >
                Save
              </button>
            </div>
          ) : (
            <>
              <p className="flex-1 text-lg font-bold">{me.displayName}</p>
              <button className="text-xs underline" style={{ color: "var(--c-textMuted)" }} onClick={() => setEditNick(true)}>
                Edit
              </button>
            </>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold">Who you are in the story</h2>
          <div className="space-y-2">
            {me.personas.map((p) => (
              <div key={p.id} className="card flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-semibold">
                    {p.name}{" "}
                    {p.isDefault && (
                      <span className="text-[10px]" style={{ color: "var(--c-primary)" }}>
                        default
                      </span>
                    )}
                  </p>
                  {p.callName && (
                    <p className="text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                      called {p.callName}
                    </p>
                  )}
                </div>
                <button className="text-xs underline" onClick={() => setEditingPersona(p)}>
                  Edit
                </button>
              </div>
            ))}
            <button
              className="btn-ghost w-full text-sm"
              onClick={() => setEditingPersona({ name: "", isDefault: me.personas.length === 0 })}
            >
              + Add a persona
            </button>
          </div>
        </section>

        {likes.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold">Stories you liked</h2>
            </div>
            <div data-testid="liked-row" className="hide-scrollbar flex gap-3 overflow-x-auto">
              {likes.map((s) => (
                <StoryCard key={s.id} s={s} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-1 text-sm">
          <h2 className="mb-1 text-sm font-bold">More</h2>
          <Link href="/settings" className="block py-2">
            Settings and plan
          </Link>
          <Link href="/studio" className="block py-2">
            Creator studio
          </Link>
          <Link href="/legal/terms" className="block py-2">
            Terms, privacy and content policy
          </Link>
          <button
            className="block py-2 text-left"
            onClick={async () => {
              if (!confirm("Sign out?")) return;
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/");
            }}
          >
            Sign out
          </button>
        </section>
      </main>
      <BottomTab />

      {editingPersona && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6">
          <div className="card w-full max-w-sm p-4">
            <p className="text-sm font-bold">Persona</p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
              This is who &quot;you&quot; are inside a story.
            </p>
            <label className="label mt-3">Name</label>
            <input
              className="input"
              value={editingPersona.name ?? ""}
              onChange={(e) => setEditingPersona({ ...editingPersona, name: e.target.value })}
            />
            <label className="label mt-3">What they call you</label>
            <input
              className="input"
              value={editingPersona.callName ?? ""}
              onChange={(e) => setEditingPersona({ ...editingPersona, callName: e.target.value })}
            />
            <label className="label mt-3">Anything else worth knowing</label>
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
              Use this by default
            </label>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary flex-1 py-2 text-sm" onClick={savePersona}>
                Save
              </button>
              <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => setEditingPersona(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
