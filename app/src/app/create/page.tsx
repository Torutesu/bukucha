"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { postSse } from "@/components/sse-client";

interface Character {
  id: string;
  name: string;
  personality: string;
  speechStyle: string;
  relationship: string;
  exampleDialogs: { user: string; char: string }[];
  sortOrder: number;
}
interface Intro {
  id: string;
  label: string;
  introText: string;
  firstMessage: string;
}
interface Story {
  id: string;
  title: string;
  logline: string;
  worldSetting: string;
  contentLevel: "ALL_AGES" | "TEEN";
  characters: Character[];
  intros: Intro[];
  tags: { tag: { id: string; name: string } }[];
}

const STEPS = ["Premise", "World", "Cast", "Openings", "Test play", "Publish"];

function CreateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState(0);
  const [story, setStory] = useState<Story | null>(null);
  const [premise, setPremise] = useState(params.get("premise") ?? "");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState(false);
  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([]);
  const [testMessages, setTestMessages] = useState<{ role: "USER" | "AI"; content: string }[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testGenerating, setTestGenerating] = useState(false);
  const [testStream, setTestStream] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<
    { status: string } | { blocked: { kind: string; detail: string }[] } | null
  >(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  // Track in-flight saves so a step change or publish never races a write.
  const pendingSaves = useRef<Promise<unknown>[]>([]);
  const track = <T,>(p: Promise<T>): Promise<T> => {
    pendingSaves.current.push(p);
    return p;
  };
  const flushSaves = async () => {
    const all = pendingSaves.current;
    pendingSaves.current = [];
    await Promise.allSettled(all);
  };
  const goStep = async (n: number) => {
    await flushSaves();
    setStep(n);
  };

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then(setAllTags)
      .catch(() => {});
  }, []);

  // Resume an existing draft.
  useEffect(() => {
    const sid = params.get("storyId");
    if (sid) {
      fetch(`/api/stories/${sid}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) {
            setStory(normalize(d));
            const q = Number(params.get("step"));
            setStep(Number.isFinite(q) && q >= 1 && q <= 5 ? q : 1);
          }
        });
    }
    if (params.get("blank") || params.get("storyId")) return;
    // Bounce to sign-in if there is no session.
    fetch("/api/me").then((r) => {
      if (r.status === 401) router.replace(`/login?returnTo=${encodeURIComponent("/create")}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function normalize(d: Story): Story {
    return {
      ...d,
      characters: d.characters.map((c) => ({
        ...c,
        exampleDialogs: Array.isArray(c.exampleDialogs) ? c.exampleDialogs : [],
      })),
    };
  }

  const patch = useCallback(
    async (data: Partial<Story> & { tagIds?: string[] }) => {
      if (!story) return;
      setStory({ ...story, ...data } as Story);
      await track(fetch(`/api/stories/${story.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      }));
    },
    [story]
  );

  const runDraft = async () => {
    if (premise.trim().length < 10) return;
    setDrafting(true);
    setDraftError(false);
    try {
      const r = await fetch("/api/stories/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ premise }),
      });
      if (!r.ok) throw new Error();
      setStory(normalize(await r.json()));
      setStep(1);
    } catch {
      setDraftError(true);
    } finally {
      setDrafting(false);
    }
  };

  const startBlank = async () => {
    const r = await fetch("/api/stories", { method: "POST" });
    if (r.ok) {
      setStory(normalize(await r.json()));
      setStep(1);
    }
  };

  const runTest = async () => {
    if (!story || testGenerating || !testInput.trim()) return;
    const content = testInput;
    setTestMessages((m) => [...m, { role: "USER", content }]);
    setTestInput("");
    setTestGenerating(true);
    setTestStream("");
    await postSse(
      `/api/stories/${story.id}/test-turn`,
      { history: testMessages.slice(-6), content },
      {
        onToken: (t) => setTestStream((s) => s + t),
        onDone: (d) => setTestMessages((m) => [...m, { role: "AI", content: d.message?.content ?? "" }]),
        onError: () => setTestMessages((m) => [...m, { role: "AI", content: "(that one did not come through — try again)" }]),
      }
    );
    setTestStream("");
    setTestGenerating(false);
  };

  const publish = async (visibility: "PUBLISHED" | "PRIVATE") => {
    if (!story) return;
    await flushSaves();
    setPublishing(true);
    setPublishResult(null);
    setPublishError(null);
    const r = await fetch(`/api/stories/${story.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visibility }),
    });
    const j = await r.json();
    if (!r.ok || j.error) {
      setPublishError(j?.error?.message ?? "We could not publish that.");
    } else {
      setPublishResult(j);
    }
    setPublishing(false);
  };

  // ---- Step 0: the premise ----
  if (step === 0 && !story) {
    return (
      <main className="flex min-h-dvh flex-col px-5 py-8">
        <StepBar step={0} />
        <label htmlFor="premise" className="mt-6 block text-lg font-bold">
          One line. That is all we need.
        </label>
        <p className="mt-1 text-xs" style={{ color: "var(--c-textMuted)" }}>
          We will draft the world, the cast, the openings, the stats and four endings. You
          edit from there.
        </p>
        <textarea
          id="premise"
          className="input mt-4 h-28"
          placeholder="e.g. The duke who bought my family's debt has never once mentioned money."
          maxLength={200}
          value={premise}
          onChange={(e) => setPremise(e.target.value)}
        />
        {drafting && (
          <div className="card mt-4 p-4 text-center text-sm">
            <p className="animate-pulse">Building the world…</p>
            <p className="mt-1 text-xs" style={{ color: "var(--c-textMuted)" }}>
              world → cast → openings → stats → endings
            </p>
          </div>
        )}
        {draftError && (
          <div className="card mt-4 p-3 text-sm">
            That did not come together. Try again, or start from a blank story.
          </div>
        )}
        <button
          className="btn-primary mt-4 w-full disabled:opacity-40"
          disabled={premise.trim().length < 10 || drafting}
          onClick={runDraft}
        >
          Draft it for me
        </button>
        <button className="mt-3 text-center text-xs underline" style={{ color: "var(--c-textMuted)" }} onClick={startBlank}>
          Start blank
        </button>
      </main>
    );
  }

  if (!story) return <main className="p-8 text-center text-sm">Loading…</main>;

  return (
    <main className="flex min-h-dvh flex-col px-5 py-6">
      <StepBar step={step} />

      {/* Step 1: the world */}
      {step === 1 && (
        <div className="mt-6 space-y-4">
          <FieldWithAi
            label="Title"
            value={story.title}
            maxLength={60}
            onSave={(v) => patch({ title: v })}
            storyId={story.id}
            field="title"
            onAiResult={(v) => patch({ title: v })}
          />
          <FieldWithAi
            label="Logline"
            value={story.logline}
            maxLength={60}
            onSave={(v) => patch({ logline: v })}
            storyId={story.id}
            field="logline"
            onAiResult={(v) => patch({ logline: v })}
          />
          <FieldWithAi
            label="The world"
            value={story.worldSetting}
            textarea
            onSave={(v) => patch({ worldSetting: v })}
            storyId={story.id}
            field="worldSetting"
            onAiResult={(v) => patch({ worldSetting: v })}
          />
          <NavButtons onNext={() => goStep(2)} />
        </div>
      )}

      {/* Step 2: the cast */}
      {step === 2 && (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-bold">Cast</p>
          {story.characters
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((c) => (
              <Link
                key={c.id}
                href={`/create/${story.id}/characters/${c.id}`}
                data-testid="character-item"
                className="card flex w-full items-center justify-between p-3 text-left"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {c.name}{" "}
                    {c.sortOrder === 0 && (
                      <span className="text-[10px]" style={{ color: "var(--c-primary)" }}>
                        lead
                      </span>
                    )}
                  </p>
                  <p className="line-clamp-1 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                    {c.relationship || "no relationship set"}
                  </p>
                </div>
                <span>›</span>
              </Link>
            ))}
          {story.characters.length < 3 && (
            <button
              className="btn-ghost w-full text-sm"
              onClick={async () => {
                const r = await fetch(`/api/stories/${story.id}/characters`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ name: "New character" }),
                });
                if (r.ok) {
                  const c = await r.json();
                  setStory({ ...story, characters: [...story.characters, { ...c, exampleDialogs: [] }] });
                }
              }}
            >
              + Add a character
            </button>
          )}
          <NavButtons onBack={() => goStep(1)} onNext={() => goStep(3)} />
        </div>
      )}

      {/* Step 3: the openings */}
      {step === 3 && (
        <div className="mt-6 space-y-4">
          <p className="text-sm font-bold">Openings (up to 3)</p>
          {story.intros.map((iv, idx) => (
            <div key={iv.id} className="card space-y-2 p-3">
              <div>
                <label className="label" htmlFor={`intro-label-${iv.id}`}>
                  Name
                </label>
                <input
                  id={`intro-label-${iv.id}`}
                  className="input"
                  value={iv.label}
                  onChange={(e) => {
                    const intros = [...story.intros];
                    intros[idx] = { ...iv, label: e.target.value };
                    setStory({ ...story, intros });
                  }}
                  onBlur={(e) =>
                    track(fetch(`/api/stories/${story.id}/intros/${iv.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ label: e.target.value }),
                    }))
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor={`intro-text-${iv.id}`}>
                  Establishing prose
                </label>
                <textarea
                  id={`intro-text-${iv.id}`}
                  className="input h-20"
                  value={iv.introText}
                  onChange={(e) => {
                    const intros = [...story.intros];
                    intros[idx] = { ...iv, introText: e.target.value };
                    setStory({ ...story, intros });
                  }}
                  onBlur={(e) =>
                    track(fetch(`/api/stories/${story.id}/intros/${iv.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ introText: e.target.value }),
                    }))
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor={`intro-first-${iv.id}`}>
                  Opening scene
                </label>
                <textarea
                  id={`intro-first-${iv.id}`}
                  className="input h-20"
                  value={iv.firstMessage}
                  onChange={(e) => {
                    const intros = [...story.intros];
                    intros[idx] = { ...iv, firstMessage: e.target.value };
                    setStory({ ...story, intros });
                  }}
                  onBlur={(e) =>
                    track(fetch(`/api/stories/${story.id}/intros/${iv.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ firstMessage: e.target.value }),
                    }))
                  }
                />
              </div>
            </div>
          ))}
          {story.intros.length < 3 && (
            <button
              className="btn-ghost w-full text-sm"
              onClick={async () => {
                const r = await fetch(`/api/stories/${story.id}/intros`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ label: "New opening" }),
                });
                if (r.ok) setStory({ ...story, intros: [...story.intros, await r.json()] });
              }}
            >
              + Add an opening
            </button>
          )}
          <NavButtons onBack={() => goStep(2)} onNext={() => goStep(4)} />
        </div>
      )}

      {/* Step 4: test play */}
      {step === 4 && (
        <div className="mt-6 flex flex-1 flex-col">
          <p className="text-sm font-bold">Does this sound right? (nothing here is saved)</p>
          <div className="card novel my-3 flex-1 space-y-3 overflow-y-auto p-3" style={{ minHeight: "40vh" }}>
            <p className="text-xs" style={{ color: "var(--c-textMuted)" }}>
              {story.intros[0]?.introText}
            </p>
            {testMessages.map((m, i) =>
              m.role === "USER" ? (
                <p key={i} className="text-right text-sm opacity-80">
                  {m.content}
                </p>
              ) : (
                <p key={i} data-testid="ai-line" className="whitespace-pre-wrap">
                  {m.content}
                </p>
              )
            )}
            {testGenerating && (
              <p data-testid="generating" className="whitespace-pre-wrap">
                {testStream}
                <span className="caret">▌</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Say something, or *do something*"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runTest()}
            />
            <button aria-label="Send" className="btn-primary px-4" onClick={runTest} disabled={testGenerating}>
              ▶
            </button>
          </div>
          <NavButtons onBack={() => goStep(3)} onNext={() => goStep(5)} />
        </div>
      )}

      {/* Step 5: publish */}
      {step === 5 && (
        <div className="mt-6 space-y-4">
          <div>
            <p className="label">Tags (up to 6)</p>
            <div data-testid="tag-select" className="flex flex-wrap gap-2">
              {allTags.map((t) => {
                const on = story.tags.some((st) => st.tag.id === t.id);
                return (
                  <button
                    key={t.id}
                    className="chip"
                    data-on={on}
                    onClick={() => {
                      const next = on
                        ? story.tags.filter((st) => st.tag.id !== t.id)
                        : [...story.tags, { tag: t }];
                      if (next.length > 6) return;
                      setStory({ ...story, tags: next });
                      patch({ tagIds: next.map((n) => n.tag.id) });
                    }}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="label">Rating</p>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="level"
                  aria-label="All ages"
                  checked={story.contentLevel === "ALL_AGES"}
                  onChange={() => patch({ contentLevel: "ALL_AGES" })}
                />
                All ages
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="level"
                  aria-label="TEEN"
                  checked={story.contentLevel === "TEEN"}
                  onChange={() => patch({ contentLevel: "TEEN" })}
                />
                18+ (charged, never explicit)
              </label>
            </div>
            {story.contentLevel === "TEEN" && (
              <p className="mt-1 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                18+ stories are shown only to readers who have confirmed their age.
              </p>
            )}
          </div>

          {publishError && (
            <div data-testid="publish-error" className="card p-3 text-sm" style={{ borderColor: "var(--c-danger)" }}>
              {publishError}
            </div>
          )}

          {publishResult && "blocked" in publishResult && (
            <div data-testid="moderation-error" className="card p-3 text-sm" style={{ borderColor: "var(--c-danger)" }}>
              {publishResult.blocked.map((b, i) => (
                <p key={i} className="mb-1">
                  {b.detail}
                </p>
              ))}
              <div className="mt-2 flex gap-2">
                <button className="btn-ghost flex-1 py-2 text-xs" onClick={() => setStep(1)}>
                  Back to step 1
                </button>
                <button className="btn-ghost flex-1 py-2 text-xs" onClick={() => setStep(5)}>
                  Publish again from step 5
                </button>
              </div>
            </div>
          )}

          {publishResult && "status" in publishResult && publishResult.status === "PUBLISHED" ? (
            <div className="card p-5 text-center">
              <p className="text-lg font-bold">It is live.</p>
              <Link href={`/story/${story.id}`} className="btn-primary mt-3 block">
                See the story page
              </Link>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I wrote "${story.title}" — come play it`)}`}
                target="_blank"
                className="mt-2 block text-xs underline"
                style={{ color: "var(--c-textMuted)" }}
              >
                Share
              </a>
            </div>
          ) : (
            <>
              <button className="btn-primary w-full" disabled={publishing} onClick={() => publish("PUBLISHED")}>
                Publish
              </button>
              <button className="btn-ghost w-full text-sm" disabled={publishing} onClick={() => publish("PRIVATE")}>
                Save as private
              </button>
            </>
          )}
          <NavButtons onBack={() => goStep(4)} />
        </div>
      )}

    </main>
  );
}

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1" data-testid="step-indicator" data-step={step}>
      {STEPS.map((s, i) => (
        <div key={s} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="h-1 w-full rounded-full"
            style={{ background: i <= step ? "var(--c-primary)" : "var(--c-border)" }}
          />
          <span className="text-[9px]" style={{ color: i === step ? "var(--c-primary)" : "var(--c-textMuted)" }}>
            {s}
          </span>
        </div>
      ))}
    </div>
  );
}

function NavButtons({ onBack, onNext }: { onBack?: () => void; onNext?: () => void }) {
  return (
    <div className="mt-6 flex gap-2">
      {onBack && (
        <button className="btn-ghost flex-1" onClick={onBack}>
          Back
        </button>
      )}
      {onNext && (
        <button className="btn-primary flex-1" onClick={onNext}>
          Next
        </button>
      )}
    </div>
  );
}

function FieldWithAi({
  label,
  value,
  textarea,
  maxLength,
  onSave,
  onAiResult,
  storyId,
  field,
}: {
  label: string;
  value: string;
  textarea?: boolean;
  maxLength?: number;
  onSave: (v: string) => void;
  onAiResult: (v: string) => void;
  storyId: string;
  field: string;
}) {
  const [local, setLocal] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const [loading, setLoading] = useState(false);
  const fieldId = `field-${field}`;
  // Follow an externally changed value (an AI draft landing) during render.
  if (syncedValue !== value) {
    setSyncedValue(value);
    setLocal(value);
  }
  const runAi = async () => {
    setLoading(true);
    const r = await fetch(`/api/stories/${storyId}/rewrite-field`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field }),
    });
    if (r.ok) {
      const { text } = await r.json();
      setLocal(text);
      onAiResult(text);
    }
    setLoading(false);
  };
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label" htmlFor={fieldId}>
          {label}
        </label>
        <button className="text-[11px]" style={{ color: "var(--c-accent)" }} onClick={runAi} disabled={loading}>
          {loading ? "…" : "Rewrite this for me"}
        </button>
      </div>
      {textarea ? (
        <textarea
          id={fieldId}
          className="input h-32"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onSave(local)}
        />
      ) : (
        <input
          id={fieldId}
          className="input"
          maxLength={maxLength}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onSave(local)}
        />
      )}
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense>
      <CreateInner />
    </Suspense>
  );
}
