"use client";
import { PartyPopper, Plus, Send, Sparkles } from "lucide-react";

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
interface Situation {
  id: string;
  title: string;
  catchphrase: string;
  worldSetting: string;
  contentLevel: "ALL_AGES" | "R15";
  characters: Character[];
  intros: Intro[];
  tags: { tag: { id: string; name: string } }[];
}

const STEPS = ["妄想", "世界観", "人物", "はじまり", "テスト", "公開"];

function CreateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState(0);
  const [situation, setSituation] = useState<Situation | null>(null);
  const [fantasy, setFantasy] = useState(params.get("fantasy") ?? "");
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
  // 保存中のリクエストを追跡し、ステップ移動・公開の前に必ず完了させる(取りこぼし防止)
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

  // 既存下書きの再開
  useEffect(() => {
    const sid = params.get("situationId");
    if (sid) {
      fetch(`/api/situations/${sid}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) {
            setSituation(normalize(d));
            const q = Number(params.get("step"));
            setStep(Number.isFinite(q) && q >= 1 && q <= 5 ? q : 1);
          }
        });
    }
    if (params.get("blank") || params.get("situationId")) return;
    // fetch("/api/me") で未ログインなら弾く
    fetch("/api/me").then((r) => {
      if (r.status === 401) router.replace(`/login?returnTo=${encodeURIComponent("/create")}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function normalize(d: Situation): Situation {
    return {
      ...d,
      characters: d.characters.map((c) => ({
        ...c,
        exampleDialogs: Array.isArray(c.exampleDialogs) ? c.exampleDialogs : [],
      })),
    };
  }

  const patch = useCallback(
    async (data: Partial<Situation> & { tagIds?: string[] }) => {
      if (!situation) return;
      setSituation({ ...situation, ...data } as Situation);
      await track(fetch(`/api/situations/${situation.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      }));
    },
    [situation]
  );

  const runDraft = async () => {
    if (fantasy.trim().length < 10) return;
    setDrafting(true);
    setDraftError(false);
    try {
      const r = await fetch("/api/situations/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fantasy }),
      });
      if (!r.ok) throw new Error();
      setSituation(normalize(await r.json()));
      setStep(1);
    } catch {
      setDraftError(true);
    } finally {
      setDrafting(false);
    }
  };

  const startBlank = async () => {
    const r = await fetch("/api/situations", { method: "POST" });
    if (r.ok) {
      setSituation(normalize(await r.json()));
      setStep(1);
    }
  };

  const runTest = async () => {
    if (!situation || testGenerating || !testInput.trim()) return;
    const content = testInput;
    setTestMessages((m) => [...m, { role: "USER", content }]);
    setTestInput("");
    setTestGenerating(true);
    setTestStream("");
    await postSse(
      `/api/situations/${situation.id}/test-turn`,
      { history: testMessages.slice(-6), content },
      {
        onToken: (t) => setTestStream((s) => s + t),
        onDone: (d) => setTestMessages((m) => [...m, { role: "AI", content: d.message?.content ?? "" }]),
        onError: () => setTestMessages((m) => [...m, { role: "AI", content: "(生成に失敗しました)" }]),
      }
    );
    setTestStream("");
    setTestGenerating(false);
  };

  const publish = async (visibility: "PUBLISHED" | "PRIVATE") => {
    if (!situation) return;
    await flushSaves();
    setPublishing(true);
    setPublishResult(null);
    setPublishError(null);
    const r = await fetch(`/api/situations/${situation.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visibility }),
    });
    const j = await r.json();
    if (!r.ok || j.error) {
      setPublishError(j?.error?.message ?? "公開できませんでした");
    } else {
      setPublishResult(j);
    }
    setPublishing(false);
  };

  // ---- Step0: 妄想入力 ----
  if (step === 0 && !situation) {
    return (
      <main className="flex min-h-dvh flex-col px-5 py-8">
        <StepBar step={0} />
        <label htmlFor="fantasy" className="mt-6 block text-lg font-bold">
          あなたの妄想を、一文で。
        </label>
        <p className="mt-1 text-xs" style={{ color: "var(--c-textMuted)" }}>
          AIが世界観・登場人物・冒頭シーンまで下書きします
        </p>
        <textarea
          id="fantasy"
          className="input mt-4 h-28"
          placeholder="例: 没落令嬢の私を買ったのは、冷酷と噂の若き公爵だった"
          maxLength={200}
          value={fantasy}
          onChange={(e) => setFantasy(e.target.value)}
        />
        {drafting && (
          <div className="card mt-4 p-4 text-center text-sm">
            <p className="animate-pulse">世界を組み立てています…</p>
            <p className="mt-1 text-xs" style={{ color: "var(--c-textMuted)" }}>
              世界観 → 人物 → 冒頭
            </p>
          </div>
        )}
        {draftError && (
          <div className="card mt-4 p-3 text-sm">
            うまく作れませんでした。もう一度試すか、白紙から作れます。
          </div>
        )}
        <button
          className="btn-primary mt-4 w-full disabled:opacity-40"
          disabled={fantasy.trim().length < 10 || drafting}
          onClick={runDraft}
        >
          <Sparkles size={16} className="mr-1.5 inline align-[-3px]" />
          AIに下書きしてもらう
        </button>
        <button className="mt-3 text-center text-xs underline" style={{ color: "var(--c-textMuted)" }} onClick={startBlank}>
          白紙から作る
        </button>
      </main>
    );
  }

  if (!situation) return <main className="p-8 text-center text-sm">読み込み中…</main>;

  return (
    <main className="flex min-h-dvh flex-col px-5 py-6">
      <StepBar step={step} />

      {/* Step1: 世界観 */}
      {step === 1 && (
        <div className="mt-6 space-y-4">
          <FieldWithAi
            label="タイトル"
            value={situation.title}
            maxLength={60}
            onSave={(v) => patch({ title: v })}
            situationId={situation.id}
            field="title"
            onAiResult={(v) => patch({ title: v })}
          />
          <FieldWithAi
            label="ひとこと紹介"
            value={situation.catchphrase}
            maxLength={60}
            onSave={(v) => patch({ catchphrase: v })}
            situationId={situation.id}
            field="catchphrase"
            onAiResult={(v) => patch({ catchphrase: v })}
          />
          <FieldWithAi
            label="世界観"
            value={situation.worldSetting}
            textarea
            onSave={(v) => patch({ worldSetting: v })}
            situationId={situation.id}
            field="worldSetting"
            onAiResult={(v) => patch({ worldSetting: v })}
          />
          <NavButtons onNext={() => goStep(2)} />
        </div>
      )}

      {/* Step2: 人物 */}
      {step === 2 && (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-bold">登場人物</p>
          {situation.characters
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((c) => (
              <Link
                key={c.id}
                href={`/create/${situation.id}/characters/${c.id}`}
                data-testid="character-item"
                className="card flex w-full items-center justify-between p-3 text-left"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {c.name} {c.sortOrder === 0 && <span className="text-[10px]" style={{ color: "var(--c-primary)" }}>主演</span>}
                  </p>
                  <p className="line-clamp-1 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                    {c.relationship || "関係未設定"}
                  </p>
                </div>
                <span>›</span>
              </Link>
            ))}
          {situation.characters.length < 3 && (
            <button
              className="btn-ghost w-full text-sm"
              onClick={async () => {
                const r = await fetch(`/api/situations/${situation.id}/characters`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ name: "新しいキャラ" }),
                });
                if (r.ok) {
                  const c = await r.json();
                  setSituation({ ...situation, characters: [...situation.characters, { ...c, exampleDialogs: [] }] });
                }
              }}
            >
              <Plus size={15} className="mr-1 inline align-[-2px]" /> 人物を追加
            </button>
          )}
          <NavButtons onBack={() => goStep(1)} onNext={() => goStep(3)} />
        </div>
      )}

      {/* Step3: はじまり */}
      {step === 3 && (
        <div className="mt-6 space-y-4">
          <p className="text-sm font-bold">はじまりの場面(最大3)</p>
          {situation.intros.map((iv, idx) => (
            <div key={iv.id} className="card space-y-2 p-3">
              <div>
                <label className="label" htmlFor={`intro-label-${iv.id}`}>
                  ラベル
                </label>
                <input
                  id={`intro-label-${iv.id}`}
                  className="input"
                  value={iv.label}
                  onChange={(e) => {
                    const intros = [...situation.intros];
                    intros[idx] = { ...iv, label: e.target.value };
                    setSituation({ ...situation, intros });
                  }}
                  onBlur={(e) =>
                    track(fetch(`/api/situations/${situation.id}/intros/${iv.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ label: e.target.value }),
                    }))
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor={`intro-text-${iv.id}`}>
                  導入の地の文
                </label>
                <textarea
                  id={`intro-text-${iv.id}`}
                  className="input h-20"
                  value={iv.introText}
                  onChange={(e) => {
                    const intros = [...situation.intros];
                    intros[idx] = { ...iv, introText: e.target.value };
                    setSituation({ ...situation, intros });
                  }}
                  onBlur={(e) =>
                    track(fetch(`/api/situations/${situation.id}/intros/${iv.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ introText: e.target.value }),
                    }))
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor={`intro-first-${iv.id}`}>
                  最初の返答
                </label>
                <textarea
                  id={`intro-first-${iv.id}`}
                  className="input h-20"
                  value={iv.firstMessage}
                  onChange={(e) => {
                    const intros = [...situation.intros];
                    intros[idx] = { ...iv, firstMessage: e.target.value };
                    setSituation({ ...situation, intros });
                  }}
                  onBlur={(e) =>
                    track(fetch(`/api/situations/${situation.id}/intros/${iv.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ firstMessage: e.target.value }),
                    }))
                  }
                />
              </div>
            </div>
          ))}
          {situation.intros.length < 3 && (
            <button
              className="btn-ghost w-full text-sm"
              onClick={async () => {
                const r = await fetch(`/api/situations/${situation.id}/intros`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ label: "新しいはじまり" }),
                });
                if (r.ok) setSituation({ ...situation, intros: [...situation.intros, await r.json()] });
              }}
            >
              <Plus size={15} className="mr-1 inline align-[-2px]" /> はじまりを追加
            </button>
          )}
          <NavButtons onBack={() => goStep(2)} onNext={() => goStep(4)} />
        </div>
      )}

      {/* Step4: テスト */}
      {step === 4 && (
        <div className="mt-6 flex flex-1 flex-col">
          <p className="text-sm font-bold">この口調でOK?(お試し・保存されません)</p>
          <div className="card novel my-3 flex-1 space-y-3 overflow-y-auto p-3" style={{ minHeight: "40vh" }}>
            <p className="text-xs" style={{ color: "var(--c-textMuted)" }}>
              {situation.intros[0]?.introText}
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
              placeholder="セリフか、*動作* を書く…"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runTest()}
            />
            <button aria-label="送信" className="btn-primary px-4" onClick={runTest} disabled={testGenerating}>
              <Send size={16} />
            </button>
          </div>
          <NavButtons onBack={() => goStep(3)} onNext={() => goStep(5)} />
        </div>
      )}

      {/* Step5: 公開 */}
      {step === 5 && (
        <div className="mt-6 space-y-4">
          <div>
            <p className="label">タグ(最大6)</p>
            <div data-testid="tag-select" className="flex flex-wrap gap-2">
              {allTags.map((t) => {
                const on = situation.tags.some((st) => st.tag.id === t.id);
                return (
                  <button
                    key={t.id}
                    className="chip"
                    data-on={on}
                    onClick={() => {
                      const next = on
                        ? situation.tags.filter((st) => st.tag.id !== t.id)
                        : [...situation.tags, { tag: t }];
                      if (next.length > 6) return;
                      setSituation({ ...situation, tags: next });
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
            <p className="label">コンテンツレベル</p>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="level"
                  aria-label="全年齢"
                  checked={situation.contentLevel === "ALL_AGES"}
                  onChange={() => patch({ contentLevel: "ALL_AGES" })}
                />
                全年齢
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="level"
                  aria-label="R15"
                  checked={situation.contentLevel === "R15"}
                  onChange={() => patch({ contentLevel: "R15" })}
                />
                R15(センシティブ)
              </label>
            </div>
            {situation.contentLevel === "R15" && (
              <p className="mt-1 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                ※R15作品は年齢確認済みの読者にのみ表示されます
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
                  Step1にもどる
                </button>
                <button className="btn-ghost flex-1 py-2 text-xs" onClick={() => setStep(5)}>
                  Step5で再公開
                </button>
              </div>
            </div>
          )}

          {publishResult && "status" in publishResult && publishResult.status === "PUBLISHED" ? (
            <div className="card p-5 text-center">
              <p className="text-lg font-bold"><PartyPopper size={18} className="mr-1.5 inline align-[-3px]" style={{ color: "var(--c-primary)" }} /> 公開しました</p>
              <Link href={`/s/${situation.id}`} className="btn-primary mt-3 block">
                作品ページを見る
              </Link>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`「${situation.title}」を書きました`)}`}
                target="_blank"
                className="mt-2 block text-xs underline"
                style={{ color: "var(--c-textMuted)" }}
              >
                Xでシェア
              </a>
            </div>
          ) : (
            <>
              <button className="btn-primary w-full" disabled={publishing} onClick={() => publish("PUBLISHED")}>
                公開する
              </button>
              <button className="btn-ghost w-full text-sm" disabled={publishing} onClick={() => publish("PRIVATE")}>
                非公開で保存
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
          もどる
        </button>
      )}
      {onNext && (
        <button className="btn-primary flex-1" onClick={onNext}>
          次へ
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
  situationId,
  field,
}: {
  label: string;
  value: string;
  textarea?: boolean;
  maxLength?: number;
  onSave: (v: string) => void;
  onAiResult: (v: string) => void;
  situationId: string;
  field: string;
}) {
  const [local, setLocal] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const [loading, setLoading] = useState(false);
  const fieldId = `field-${field}`;
  // 外部(AI下書き等)でvalueが変わったらレンダー中に追従させる
  if (syncedValue !== value) {
    setSyncedValue(value);
    setLocal(value);
  }
  const runAi = async () => {
    setLoading(true);
    const r = await fetch(`/api/situations/${situationId}/rewrite-field`, {
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
          {loading ? (
            "…"
          ) : (
            <>
              <Sparkles size={13} className="mr-1 inline align-[-2px]" /> AIに書き直してもらう
            </>
          )}
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
