"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postSse } from "./sse-client";
import { brand } from "@/lib/theme";

export interface ReaderMessage {
  idx: number;
  role: "USER" | "AI" | "SYSTEM";
  content: string;
  choices?: { id: string; text: string }[] | null;
  deltas?: { delta: number; reason: string; statDef: { name: string; icon: string } }[];
}

interface GuestRoute {
  storyId: string;
  storySlug?: string;
  introId: string;
  title: string;
  introText: string;
  messages: { role: "USER" | "AI"; content: string }[];
}

interface StatView {
  id: string;
  key: string;
  name: string;
  icon: string;
  value: number;
  min: number;
  max: number;
  level: string | null;
}

interface CanonFact {
  id: string;
  category: string;
  subject: string;
  statement: string;
  pinned: boolean;
  sourceTurn: number;
}

interface RadarEntry {
  id: string;
  rarity: "N" | "R" | "SR" | "SSR";
  hint: string;
  progress: number;
}

interface EndingCard {
  id: string;
  name: string;
  rarity: "N" | "R" | "SR" | "SSR";
  epilogue: string;
}

interface CrisisPayload {
  headline: string;
  body: string;
  lines: { name: string; contact: string; href: string }[];
}

const CANON_CATEGORIES = ["PERSON", "RELATIONSHIP", "PROMISE", "WORLD", "EVENT", "TRAIT"] as const;

/** *asterisks* in the reader's own line render as narration. */
function UserContent({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("*") && p.endsWith("*") ? (
          <em key={i}>{p.slice(1, -1)}</em>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

// SCR-006: the reader. Everything else in the product exists to get someone here.
export function Reader(props: {
  mode: "auth" | "guest";
  routeId?: string;
  storyId?: string;
  storyTitle?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(props.storyTitle ?? "");
  const [storyId, setStoryId] = useState(props.storyId ?? "");
  const [storySlug, setStorySlug] = useState("");
  const [playGuide, setPlayGuide] = useState("");
  const [messages, setMessages] = useState<ReaderMessage[] | null>(null);
  const [stats, setStats] = useState<StatView[]>([]);
  const [canon, setCanon] = useState<CanonFact[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [quotaMsg, setQuotaMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tierNote, setTierNote] = useState<string | null>(null);
  const [intermission, setIntermission] = useState(false);
  const [crisis, setCrisis] = useState<CrisisPayload | null>(null);
  const [radar, setRadar] = useState<RadarEntry[]>([]);
  const [ending, setEnding] = useState<EndingCard | null>(null);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const [rewindMode, setRewindMode] = useState(false);
  const [rewindIdx, setRewindIdx] = useState<number | null>(null);
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [canonOpen, setCanonOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [userNote, setUserNote] = useState("");
  const [summary, setSummary] = useState("");
  const [savedToast, setSavedToast] = useState(false);
  const [newFact, setNewFact] = useState("");
  const [guestGate, setGuestGate] = useState(false);
  const guestRef = useRef<GuestRoute | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pressStartRef = useRef(0);

  const loadCanon = useCallback(async () => {
    if (props.mode !== "auth") return;
    const r = await fetch(`/api/routes/${props.routeId}/canon`);
    if (r.ok) setCanon((await r.json()).items);
  }, [props.mode, props.routeId]);

  useEffect(() => {
    (async () => {
      if (props.mode === "guest") {
        const raw = localStorage.getItem("hc_guest_route");
        if (!raw) {
          router.replace("/");
          return;
        }
        const g: GuestRoute = JSON.parse(raw);
        guestRef.current = g;
        setTitle(g.title);
        setStoryId(g.storyId);
        const base: ReaderMessage[] = [{ idx: 0, role: "SYSTEM", content: g.introText }];
        if (g.messages.length === 0) {
          const r = await fetch(`/api/stories/${g.storyId}`);
          if (r.ok) {
            const d = await r.json();
            setStorySlug(d.slug ?? "");
            const intro = d.intros.find((i: { id: string }) => i.id === g.introId);
            if (intro) {
              setPlayGuide(intro.playGuide ?? "");
              g.messages.push({ role: "AI", content: intro.firstMessage });
              localStorage.setItem("hc_guest_route", JSON.stringify(g));
            }
          }
        }
        setMessages([
          ...base,
          ...g.messages.map((m, i) => ({ idx: i + 1, role: m.role, content: m.content })),
        ]);
      } else {
        const r = await fetch(`/api/routes/${props.routeId}`);
        if (!r.ok) {
          setErrorMsg("We could not load this route.");
          setMessages([]);
          return;
        }
        const st = await r.json();
        setTitle(st.story.title);
        setStoryId(st.story.id);
        setStorySlug(st.story.slug ?? "");
        setPlayGuide(st.intro?.playGuide ?? "");
        setMessages(
          st.messages.map((m: ReaderMessage & { choices: unknown }) => ({
            idx: m.idx,
            role: m.role,
            content: m.content,
            choices: (m.choices as { id: string; text: string }[] | null) ?? null,
            deltas: m.deltas ?? [],
          }))
        );
        setStats(st.statView ?? []);
        setCanon(st.canon ?? []);
        setRadar(st.radar ?? []);
        setSummary(st.memory?.summary ?? "");
        setUserNote(st.memory?.userNote ?? "");
      }
      const pending = localStorage.getItem("hc_guest_pending");
      if (pending) {
        setInput(pending);
        localStorage.removeItem("hc_guest_pending");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode, props.routeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streamText]);

  const guestUserCount = messages?.filter((m) => m.role === "USER").length ?? 0;

  const applyStatDeltas = (
    ds: { key: string; name: string; icon: string; delta: number; reason: string }[]
  ) => {
    setStats((prev) =>
      prev.map((s) => {
        const d = ds.find((x) => x.key === s.key);
        return d ? { ...s, value: Math.max(s.min, Math.min(s.max, s.value + d.delta)) } : s;
      })
    );
    setMessages((prev) => {
      if (!prev?.length) return prev;
      const last = prev[prev.length - 1];
      if (last.role !== "AI") return prev;
      return [
        ...prev.slice(0, -1),
        {
          ...last,
          deltas: ds.map((d) => ({
            delta: d.delta,
            reason: d.reason,
            statDef: { name: d.name, icon: d.icon },
          })),
        },
      ];
    });
  };

  const send = useCallback(
    async (content: string, selectedChoiceId?: string) => {
      if (generating || !messages) return;
      setBlockedMsg(null);
      setQuotaMsg(null);
      setErrorMsg(null);
      setTierNote(null);
      setCrisis(null);

      if (props.mode === "guest" && guestUserCount >= 3 && content.trim()) {
        localStorage.setItem("hc_guest_pending", content);
        setGuestGate(true);
        return;
      }

      const isContinue = !content.trim() && !selectedChoiceId;
      const maxIdx = messages.length ? messages[messages.length - 1].idx : 0;
      setMessages((prev) => prev!.map((m) => (m.choices ? { ...m, choices: null } : m)));
      if (!isContinue) {
        setMessages((prev) => [...prev!, { idx: maxIdx + 1, role: "USER", content }]);
      }
      setInput("");
      setGenerating(true);
      setStreamText("");

      const restore = () => {
        if (!isContinue) {
          setMessages((prev) => prev!.filter((m) => !(m.role === "USER" && m.idx === maxIdx + 1)));
          setInput(content);
        }
      };

      if (props.mode === "guest") {
        const g = guestRef.current!;
        await postSse(
          "/api/guest/turn",
          { storyId: g.storyId, introId: g.introId, history: g.messages, content },
          {
            onToken: (t) => setStreamText((s) => s + t),
            onBlocked: (msg) => {
              setBlockedMsg(msg);
              restore();
            },
            onCrisis: (d) => {
              setCrisis(d);
              restore();
            },
            onError: (_c, msg) => {
              setErrorMsg(msg);
              setLastFailedInput(content);
              restore();
            },
            onDone: (d) => {
              const aiContent = d.message?.content ?? "";
              if (content.trim()) g.messages.push({ role: "USER", content });
              g.messages.push({ role: "AI", content: aiContent });
              localStorage.setItem("hc_guest_route", JSON.stringify(g));
              setMessages((prev) => [
                ...prev!,
                { idx: (prev![prev!.length - 1]?.idx ?? 0) + 1, role: "AI", content: aiContent },
              ]);
            },
          }
        );
      } else {
        await postSse(
          `/api/routes/${props.routeId}/messages`,
          { content, selectedChoiceId },
          {
            onToken: (t) => setStreamText((s) => s + t),
            onBlocked: (msg) => {
              setBlockedMsg(msg);
              restore();
            },
            onCrisis: (d) => {
              setCrisis(d);
              restore();
            },
            onIntermission: () => setIntermission(true),
            onTier: () =>
              setTierNote("You're out of Cinematic turns for now — this one ran on Standard."),
            onStats: applyStatDeltas,
            onRadar: (r) => setRadar(r as RadarEntry[]),
            onEnding: (e) => setEnding(e as EndingCard),
            onError: (code, msg) => {
              if (code === "quota_exceeded") {
                setQuotaMsg(msg);
                restore();
              } else {
                setErrorMsg(msg);
                setLastFailedInput(content);
                restore();
              }
            },
            onDone: (d) => {
              if (!d.message) return;
              setMessages((prev) => [
                ...prev!,
                {
                  idx: d.message!.idx,
                  role: "AI",
                  content: d.message!.content,
                  choices: d.message!.choices,
                },
              ]);
            },
          }
        );
        // The ledger is written after the turn is delivered, so refresh once
        // the stream has fully settled rather than on the done event.
        await loadCanon();
      }
      setStreamText("");
      setGenerating(false);
    },
    [generating, messages, props.mode, props.routeId, guestUserCount, loadCanon]
  );

  const reroll = useCallback(
    async (withInstruction?: string) => {
      if (generating || !messages || props.mode === "guest") return;
      const lastAi = [...messages].reverse().find((m) => m.role === "AI");
      if (!lastAi) return;
      setGenerating(true);
      setStreamText("");
      setMessages((prev) => prev!.filter((m) => m.idx !== lastAi.idx));
      await postSse(
        `/api/routes/${props.routeId}/messages/${lastAi.idx}/reroll`,
        withInstruction ? { instruction: withInstruction } : {},
        {
          onToken: (t) => setStreamText((s) => s + t),
          onBlocked: (msg) => {
            setBlockedMsg(msg);
            setMessages((prev) => [...prev!, lastAi].sort((a, b) => a.idx - b.idx));
          },
          onError: (_c, msg) => {
            setErrorMsg(msg);
            setMessages((prev) => [...prev!, lastAi].sort((a, b) => a.idx - b.idx));
          },
          onDone: (d) => {
            if (!d.message) return;
            setMessages((prev) =>
              [
                ...prev!,
                {
                  idx: lastAi.idx,
                  role: "AI" as const,
                  content: d.message!.content,
                  choices: d.message!.choices,
                },
              ].sort((a, b) => a.idx - b.idx)
            );
          },
        }
      );
      setStreamText("");
      setGenerating(false);
    },
    [generating, messages, props.mode, props.routeId]
  );

  const doRewind = async () => {
    if (rewindIdx === null || props.mode === "guest") return;
    const r = await fetch(`/api/routes/${props.routeId}/rewind`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toIdx: rewindIdx }),
    });
    if (r.ok) {
      setMessages((prev) => prev!.filter((m) => m.idx <= rewindIdx));
      setRewindMode(false);
      setRewindIdx(null);
      await loadCanon();
      inputRef.current?.focus();
    }
  };

  const patchFact = async (id: string, data: Record<string, unknown>) => {
    await fetch(`/api/routes/${props.routeId}/canon/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    await loadCanon();
  };

  const lastAiWithChoices = messages
    ? [...messages].reverse().find((m) => m.role === "AI" && m.choices && m.choices.length)
    : undefined;
  const isLatest =
    lastAiWithChoices && messages && lastAiWithChoices.idx === messages[messages.length - 1].idx;
  const closest = radar.filter((r) => r.progress >= 0.7).sort((a, b) => b.progress - a.progress)[0];

  return (
    <div className="reader-root flex min-h-dvh flex-col" style={{ background: "var(--c-novelBg)" }}>
      <header
        className="sticky top-0 z-10 border-b px-4 py-2.5"
        style={{
          background: "color-mix(in oklab, var(--c-novelBg) 92%, transparent)",
          borderColor: "var(--c-border)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div className="flex items-center justify-between">
          <button
            aria-label="Back"
            className="text-lg"
            onClick={() =>
              router.push(props.mode === "guest" ? `/story/${storySlug || storyId}` : "/library")
            }
          >
            ←
          </button>
          <p
            className="mx-2 flex-1 truncate text-center text-xs"
            style={{ color: "var(--c-textMuted)" }}
          >
            {title}
          </p>
          <button aria-label="Menu" className="text-lg" onClick={() => setMenuOpen(true)}>
            ⋯
          </button>
        </div>

        {/* SCR-021: the state of the route, always visible, never in the way. */}
        {stats.length > 0 && (
          <button
            data-testid="stat-hud"
            className="mt-1.5 flex w-full gap-3 text-[11px]"
            onClick={() => setStatsOpen(true)}
          >
            {stats.map((s) => (
              <span key={s.id} data-testid={`stat-${s.key}`} className="flex items-center gap-1">
                <span aria-hidden>{s.icon}</span>
                <span style={{ color: "var(--c-textMuted)" }}>{s.name}</span>
                <span className="font-semibold">{s.value}</span>
                {s.level && (
                  <span style={{ color: "var(--c-accent)" }}>· {s.level}</span>
                )}
              </span>
            ))}
          </button>
        )}
      </header>

      <main className="reader-body flex-1 px-5 py-4">
        <div data-testid="novel-stream" className="novel space-y-4">
          {!messages && <p style={{ color: "var(--c-textMuted)" }}>Loading…</p>}
          {messages?.map((m) => {
            if (m.role === "SYSTEM")
              return (
                <div key={m.idx} className="whitespace-pre-wrap opacity-90" data-testid="intro-line">
                  <p
                    className="mb-2 text-center text-[10px] uppercase tracking-[0.3em]"
                    style={{ color: "var(--c-textMuted)" }}
                  >
                    Opening
                  </p>
                  {m.content}
                </div>
              );
            if (m.role === "USER")
              return (
                <div key={m.idx} className="flex justify-end">
                  <div
                    data-testid="user-line"
                    onClick={() => rewindMode && setRewindIdx(m.idx)}
                    className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm px-3.5 py-2 text-[0.92rem]"
                    style={{
                      background:
                        rewindMode && rewindIdx === m.idx
                          ? "var(--c-primary)"
                          : "var(--c-userBubble)",
                      color: rewindMode && rewindIdx === m.idx ? "#fff" : "var(--c-novelText)",
                      cursor: rewindMode ? "pointer" : "default",
                      outline: rewindMode ? "1px dashed var(--c-primary)" : "none",
                    }}
                  >
                    <UserContent text={m.content} />
                  </div>
                </div>
              );
            return (
              <div key={m.idx}>
                <div data-testid="ai-line" className="whitespace-pre-wrap">
                  {m.content}
                </div>
                {/* AIF-003: a number that moves for a visible reason becomes a goal. */}
                {!!m.deltas?.length && (
                  <div data-testid="stat-delta" className="mt-1.5 flex flex-wrap gap-2">
                    {m.deltas.map((d, i) => (
                      <span
                        key={i}
                        className="text-[11px]"
                        style={{ color: d.delta >= 0 ? "var(--c-accent)" : "var(--c-danger)" }}
                      >
                        {d.statDef.icon} {d.statDef.name} {d.delta >= 0 ? "+" : ""}
                        {d.delta}
                        {d.reason ? ` — ${d.reason}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {generating && (
            <div data-testid="generating" className="whitespace-pre-wrap">
              {streamText}
              <span className="caret">▌</span>
            </div>
          )}

          {/* AIF-010 — generation is replaced, not decorated. */}
          {crisis && (
            <div
              data-testid="crisis-card"
              className="card p-4 text-sm"
              style={{ borderColor: "var(--c-primary)" }}
            >
              <p className="font-bold">{crisis.headline}</p>
              <p className="mt-1 text-xs">{crisis.body}</p>
              <ul className="mt-3 space-y-1">
                {crisis.lines.map((l) => (
                  <li key={l.name} className="text-xs">
                    <a href={l.href} className="underline" style={{ color: "var(--c-primary)" }}>
                      {l.name}
                    </a>{" "}
                    — {l.contact}
                  </li>
                ))}
              </ul>
              <button className="btn-ghost mt-3 w-full text-sm" onClick={() => setCrisis(null)}>
                Close
              </button>
            </div>
          )}

          {blockedMsg && (
            <div
              data-testid="blocked-card"
              className="card p-3 text-sm"
              style={{ borderColor: "var(--c-danger)" }}
            >
              {blockedMsg}
            </div>
          )}
          {quotaMsg && (
            <div data-testid="quota-card" className="card p-3 text-sm">
              {quotaMsg}
            </div>
          )}
          {tierNote && (
            <div data-testid="tier-card" className="card p-3 text-xs">
              {tierNote}{" "}
              <Link href="/settings" className="underline" style={{ color: "var(--c-primary)" }}>
                See plans
              </Link>
            </div>
          )}
          {errorMsg && (
            <div data-testid="error-card" className="card p-3 text-sm">
              {errorMsg}
              {lastFailedInput !== null && (
                <button
                  className="btn-ghost mt-2 w-full"
                  onClick={() => {
                    const c = lastFailedInput;
                    setLastFailedInput(null);
                    setInput("");
                    send(c ?? "");
                  }}
                >
                  Try that again
                </button>
              )}
            </div>
          )}

          {/* AIF-004: close enough to feel it, not close enough to be told. */}
          {closest && !ending && !generating && (
            <p
              data-testid="ending-radar"
              className="text-center text-[11px] italic"
              style={{ color: brand.rarity[closest.rarity].color }}
            >
              {closest.hint}
            </p>
          )}

          {ending && (
            <div
              data-testid="ending-card"
              className="card p-4"
              style={{ borderColor: brand.rarity[ending.rarity].color }}
            >
              <p
                className="text-[10px] uppercase tracking-[0.25em]"
                style={{ color: brand.rarity[ending.rarity].color }}
              >
                {brand.rarity[ending.rarity].label} ending
              </p>
              <p className="mt-1 text-lg font-bold">{ending.name}</p>
              <p className="novel mt-2 whitespace-pre-wrap text-[0.95rem]">{ending.epilogue}</p>
              <div className="mt-4 flex gap-2">
                <Link href={`/story/${storySlug || storyId}/endings`} className="btn-primary flex-1 text-center text-sm">
                  See your collection
                </Link>
                <Link href={`/story/${storySlug || storyId}`} className="btn-ghost flex-1 text-center text-sm">
                  Play another route
                </Link>
              </div>
            </div>
          )}

          {!generating &&
            !rewindMode &&
            !ending &&
            messages &&
            messages.some((m) => m.role === "AI") &&
            props.mode === "auth" && (
              <div className="flex gap-2 text-xs" style={{ color: "var(--c-textMuted)" }}>
                <button
                  className="btn-ghost px-3 py-1.5 text-xs"
                  onPointerDown={() => (pressStartRef.current = Date.now())}
                  onClick={() => {
                    if (Date.now() - pressStartRef.current >= 500) setInstructionOpen(true);
                    else reroll();
                  }}
                >
                  Rewrite
                </button>
                <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setRewindMode(true)}>
                  Go back
                </button>
              </div>
            )}

          {rewindMode && (
            <div className="card sticky bottom-24 z-10 p-3 text-sm">
              <p className="text-xs">Tap the line you want to return to.</p>
              <div className="mt-2 flex gap-2">
                <button
                  className="btn-primary flex-1 py-2 text-sm"
                  disabled={rewindIdx === null}
                  onClick={doRewind}
                >
                  Rewind to here
                </button>
                <button
                  className="btn-ghost flex-1 py-2 text-sm"
                  onClick={() => {
                    setRewindMode(false);
                    setRewindIdx(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isLatest && !generating && !ending && lastAiWithChoices?.choices && (
            <div data-testid="choice-card" className="space-y-2">
              {lastAiWithChoices.choices.map((c) => (
                <button
                  key={c.id}
                  className="card block w-full px-4 py-3 text-left text-sm"
                  style={{ borderColor: "var(--c-primary)" }}
                  onClick={() => send(c.text, c.id)}
                >
                  {c.text}
                </button>
              ))}
              <button
                className="text-xs underline"
                style={{ color: "var(--c-textMuted)" }}
                onClick={() => inputRef.current?.focus()}
              >
                Say something else
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Desktop only. On a phone the same content lives behind the menu. */}
        <aside className="reader-rail" data-testid="reader-rail">
          {stats.length > 0 && (
            <section className="card p-3">
              <p className="label">Where this route stands</p>
              <ul className="space-y-2">
                {stats.map((s) => (
                  <li key={s.id}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span>
                        {s.icon} {s.name}
                        {s.level && (
                          <span className="ml-1.5" style={{ color: "var(--c-accent)" }}>
                            {s.level}
                          </span>
                        )}
                      </span>
                      <span className="font-semibold">{s.value}</span>
                    </div>
                    <div
                      className="mt-1 h-1 w-full rounded-full"
                      style={{ background: "var(--c-surfaceAlt)" }}
                    >
                      <div
                        className="h-1 rounded-full"
                        style={{
                          width: `${Math.round(((s.value - s.min) / Math.max(1, s.max - s.min)) * 100)}%`,
                          background: "var(--c-accent)",
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {props.mode === "auth" && (
            <section className="card mt-3 max-h-[50vh] overflow-y-auto p-3">
              <div className="flex items-baseline justify-between">
                <p className="label mb-0">Canon</p>
                <button
                  className="text-[11px] underline"
                  style={{ color: "var(--c-primary)" }}
                  onClick={() => setCanonOpen(true)}
                >
                  Edit
                </button>
              </div>
              <ul className="mt-2 space-y-1.5">
                {canon.length === 0 && (
                  <li className="text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                    Facts land here as the story settles them.
                  </li>
                )}
                {canon.slice(0, 20).map((f) => (
                  <li key={f.id} className="text-[11px]">
                    {f.pinned && <span style={{ color: "var(--c-primary)" }}>★ </span>}
                    {f.statement}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </main>

      <footer
        className="sticky bottom-0 z-10 border-t px-3 py-2.5"
        style={{ background: "var(--c-surface)", borderColor: "var(--c-border)" }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            className="input max-h-28 flex-1 resize-none"
            placeholder="Say something, or *do something*"
            value={input}
            disabled={generating || !messages || !!ending}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`;
            }}
          />
          {input.trim() ? (
            <button
              aria-label="Send"
              className="btn-primary px-4 py-2.5"
              disabled={generating || !messages}
              onClick={() => send(input)}
            >
              ▶
            </button>
          ) : (
            <button
              className="btn-ghost whitespace-nowrap px-3 py-2.5 text-sm"
              disabled={generating || !messages || !!ending}
              onClick={() => send("")}
            >
              Continue
            </button>
          )}
        </div>
      </footer>

      {instructionOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6">
          <div className="card w-full max-w-sm p-4">
            <p className="text-sm font-bold">Rewrite, but steer it</p>
            <input
              className="input mt-2"
              placeholder="e.g. slower, and let him hesitate"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <button
                className="btn-primary flex-1 py-2 text-sm"
                onClick={() => {
                  setInstructionOpen(false);
                  reroll(instruction);
                  setInstruction("");
                }}
              >
                Rewrite
              </button>
              <button
                className="btn-ghost flex-1 py-2 text-sm"
                onClick={() => setInstructionOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setMenuOpen(false)}>
          <div
            className="card absolute right-0 top-0 h-full w-72 rounded-none p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 truncate text-sm font-bold">{title}</p>
            {props.mode === "auth" && (
              <button
                data-testid="open-canon"
                className="block w-full py-2.5 text-left text-sm"
                onClick={() => {
                  setMenuOpen(false);
                  setCanonOpen(true);
                }}
              >
                Canon <span style={{ color: "var(--c-textMuted)" }}>({canon.length})</span>
              </button>
            )}
            {playGuide && (
              <div
                className="my-2 rounded-lg p-2 text-[11px]"
                style={{ background: "var(--c-surfaceAlt)", color: "var(--c-textMuted)" }}
              >
                {playGuide}
              </div>
            )}
            <Link href={`/story/${storySlug || storyId}`} className="block w-full py-2.5 text-left text-sm">
              Story page
            </Link>
            <Link
              href={`/story/${storySlug || storyId}/endings`}
              className="block w-full py-2.5 text-left text-sm"
            >
              Endings collection
            </Link>
            {props.mode === "auth" && (
              <button
                className="block w-full py-2.5 text-left text-sm"
                onClick={async () => {
                  const detail = await fetch(`/api/stories/${storyId}`).then((r) => r.json());
                  const r = await fetch("/api/routes", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ storyId, introId: detail.intros[0].id }),
                  });
                  if (r.ok) router.push(`/play/${(await r.json()).id}`);
                }}
              >
                Start a new route
              </button>
            )}
          </div>
        </div>
      )}

      {/* SCR-024: the Canon ledger. Editing it is free, and always will be. */}
      {canonOpen && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50">
          <div
            data-testid="canon-panel"
            className="card max-h-[85vh] w-full max-w-[var(--shell-max)] overflow-y-auto rounded-b-none p-4"
          >
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-bold">Canon</p>
              <span className="text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                {canon.length} settled {canon.length === 1 ? "fact" : "facts"}
              </span>
            </div>
            <p className="mt-1 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
              What the story treats as true. Fix anything that is wrong — it costs nothing, and the
              next turn will use it.
            </p>

            <div className="mt-3 flex gap-2">
              <input
                className="input flex-1 text-sm"
                data-testid="canon-new"
                placeholder="Add something the story must remember"
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
              />
              <button
                className="btn-primary px-3 text-sm"
                disabled={!newFact.trim()}
                onClick={async () => {
                  await fetch(`/api/routes/${props.routeId}/canon`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ category: "WORLD", subject: "", statement: newFact }),
                  });
                  setNewFact("");
                  await loadCanon();
                }}
              >
                Add
              </button>
            </div>

            <ul className="mt-3 space-y-2">
              {canon.length === 0 && (
                <li className="text-xs" style={{ color: "var(--c-textMuted)" }}>
                  Nothing settled yet. Facts land here as the story establishes them.
                </li>
              )}
              {CANON_CATEGORIES.filter((cat) => canon.some((f) => f.category === cat)).map((cat) => (
                <li key={cat}>
                  <p className="label">{cat.toLowerCase()}</p>
                  <ul className="mt-1 space-y-1.5">
                    {canon
                      .filter((f) => f.category === cat)
                      .map((f) => (
                        <li key={f.id} data-testid="canon-fact" className="flex items-start gap-2">
                          <button
                            aria-label={f.pinned ? "Unpin" : "Pin"}
                            className="pt-0.5 text-xs"
                            style={{ color: f.pinned ? "var(--c-primary)" : "var(--c-textMuted)" }}
                            onClick={() => patchFact(f.id, { pinned: !f.pinned })}
                          >
                            {f.pinned ? "★" : "☆"}
                          </button>
                          <input
                            className="flex-1 bg-transparent text-xs outline-none"
                            defaultValue={f.statement}
                            onBlur={(e) => {
                              if (e.target.value !== f.statement)
                                patchFact(f.id, { statement: e.target.value });
                            }}
                          />
                          <button
                            aria-label="Remove"
                            className="pt-0.5 text-xs"
                            style={{ color: "var(--c-textMuted)" }}
                            onClick={() => patchFact(f.id, { isActive: false })}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>

            <p className="label mt-4">Standing note</p>
            <textarea
              className="input h-20"
              placeholder="Anything that should always be true of you, out of fiction"
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
            />
            {summary && (
              <>
                <p className="label mt-3">Story so far</p>
                <p className="max-h-24 overflow-y-auto text-xs">{summary}</p>
              </>
            )}
            {savedToast && (
              <p className="mt-1 text-xs" style={{ color: "var(--c-primary)" }}>
                Saved.
              </p>
            )}
            <div className="mt-3 flex gap-2 pb-2">
              <button
                className="btn-primary flex-1 py-2 text-sm"
                onClick={async () => {
                  await fetch(`/api/routes/${props.routeId}/memory`, {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ userNote }),
                  });
                  setSavedToast(true);
                  setTimeout(() => setSavedToast(false), 2500);
                }}
              >
                Save note
              </button>
              <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => setCanonOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {statsOpen && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/50"
          onClick={() => setStatsOpen(false)}
        >
          <div
            className="card w-full max-w-[var(--shell-max)] rounded-b-none p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold">Where this route stands</p>
            <ul className="mt-3 space-y-3">
              {stats.map((s) => (
                <li key={s.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>
                      {s.icon} {s.name}
                      {s.level && (
                        <span className="ml-2 text-xs" style={{ color: "var(--c-accent)" }}>
                          {s.level}
                        </span>
                      )}
                    </span>
                    <span className="font-semibold">{s.value}</span>
                  </div>
                  <div
                    className="mt-1 h-1.5 w-full rounded-full"
                    style={{ background: "var(--c-surfaceAlt)" }}
                  >
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${Math.round(((s.value - s.min) / Math.max(1, s.max - s.min)) * 100)}%`,
                        background: "var(--c-accent)",
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <button className="btn-ghost mt-4 w-full text-sm" onClick={() => setStatsOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* SCR-025: the disclosure the law requires, shaped like an act break. */}
      {intermission && (
        <div
          data-testid="intermission"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-6"
        >
          <div className="card w-full max-w-sm p-5 text-center">
            <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "var(--c-textMuted)" }}>
              Intermission
            </p>
            <p className="mt-3 text-sm font-bold">You have been reading for a while.</p>
            <p className="mt-2 text-xs" style={{ color: "var(--c-textMuted)" }}>
              Everything in this story is written by an AI. {title} is fiction, and so is everyone in
              it. Stretch, drink something, and come back when you want to.
            </p>
            <button className="btn-primary mt-4 w-full" onClick={() => setIntermission(false)}>
              Back to the story
            </button>
            <Link
              href="/library"
              className="mt-2 block text-xs underline"
              style={{ color: "var(--c-textMuted)" }}
            >
              Stop here for now
            </Link>
          </div>
        </div>
      )}

      {guestGate && (
        <div
          data-testid="guest-gate"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-6"
        >
          <div className="card w-full max-w-sm p-5 text-center">
            <p className="text-lg font-bold">Keep this route</p>
            <p className="mt-2 text-xs" style={{ color: "var(--c-textMuted)" }}>
              Sign in and everything you have played so far comes with you — the scene, the canon,
              all of it.
            </p>
            <Link
              href={`/login?returnTo=${encodeURIComponent("/play/guest")}`}
              className="btn-primary mt-4 block"
            >
              Save it and continue
            </Link>
            <button
              className="mt-2 text-xs underline"
              style={{ color: "var(--c-textMuted)" }}
              onClick={() => setGuestGate(false)}
            >
              Not yet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
