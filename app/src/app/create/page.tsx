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
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [testMessages, setTestMessages] = useState<{ role: "USER" | "AI"; content: string }[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testGenerating, setTestGenerating] = useState(false);
  const [testStream, setTestStream] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<
    { status: string } | { blocked: { kind: string; detail: string }[] } | null
  >(null);

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
            setStep(1);
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
      await fetch(`/api/situations/${situation.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
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
    setPublishing(true);
    setPublishResult(null);
    const r = await fetch(`/api/situations/${situation.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visibility }),
    });
    const j = await r.json();
    setPublishResult(j);
    setPublishing(false);
  };

  // ---- Step0: 妄想入力 ----
  if (step === 0 && !situation) {
    return (
      <main className="flex min-h-dvh flex-col px-5 py-8">
        <StepBar step={0} />
        <h1 className="mt-6 text-lg font-bold">あなたの妄想を、一文で。</h1>
        <p className="mt-1 text-xs" style={{ color: "var(--c-textMuted)" }}>
          AIが世界観・登場人物・冒頭シーンまで下書きします
        </p>
        <textarea
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
          ✦ AIに下書きしてもらう
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
          <NavButtons onNext={() => setStep(2)} />
        </div>
      )}

      {/* Step2: 人物 */}
      {step === 2 && (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-bold">登場人物</p>
          {situation.characters
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((c) => (
              <button
                key={c.id}
                data-testid="character-item"
                className="card flex w-full items-center justify-between p-3 text-left"
                onClick={() => setEditingChar(c)}
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
              </button>
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
              ＋ 人物を追加
            </button>
          )}
          <NavButtons onBack={() => setStep(1)} onNext={() => setStep(3)} />
        </div>
      )}

      {/* Step3: はじまり */}
      {step === 3 && (
        <div className="mt-6 space-y-4">
          <p className="text-sm font-bold">はじまりの場面(最大3)</p>
          {situation.intros.map((iv, idx) => (
            <div key={iv.id} className="card space-y-2 p-3">
              <div>
                <span className="label">ラベル</span>
                <input
                  className="input"
                  value={iv.label}
                  onChange={(e) => {
                    const intros = [...situation.intros];
                    intros[idx] = { ...iv, label: e.target.value };
                    setSituation({ ...situation, intros });
                  }}
                  onBlur={(e) =>
                    fetch(`/api/situations/${situation.id}/intros/${iv.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ label: e.target.value }),
                    })
                  }
                />
              </div>
              <div>
                <span className="label">導入の地の文</span>
                <textarea
                  className="input h-20"
                  value={iv.introText}
                  onChange={(e) => {
                    const intros = [...situation.intros];
                    intros[idx] = { ...iv, introText: e.target.value };
                    setSituation({ ...situation, intros });
                  }}
                  onBlur={(e) =>
                    fetch(`/api/situations/${situation.id}/intros/${iv.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ introText: e.target.value }),
                    })
                  }
                />
              </div>
              <div>
                <span className="label">最初の返答</span>
                <textarea
                  className="input h-20"
                  value={iv.firstMessage}
                  onChange={(e) => {
                    const intros = [...situation.intros];
                    intros[idx] = { ...iv, firstMessage: e.target.value };
                    setSituation({ ...situation, intros });
                  }}
                  onBlur={(e) =>
                    fetch(`/api/situations/${situation.id}/intros/${iv.id}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ firstMessage: e.target.value }),
                    })
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
              ＋ はじまりを追加
            </button>
          )}
          <NavButtons onBack={() => setStep(2)} onNext={() => setStep(4)} />
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
              <p className="whitespace-pre-wrap">
                {testStream}
                <span className="caret">▌</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="話しかけてみる"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runTest()}
            />
            <button className="btn-primary px-4" onClick={runTest} disabled={testGenerating}>
              ▶
            </button>
          </div>
          <NavButtons onBack={() => setStep(3)} onNext={() => setStep(5)} />
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
              <p className="text-lg font-bold">🎉 公開しました</p>
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
          <NavButtons onBack={() => setStep(4)} />
        </div>
      )}

      {editingChar && (
        <CharacterEditor
          situationId={situation.id}
          character={editingChar}
          canDelete={situation.characters.length > 1}
          onClose={(updated, deleted) => {
            setEditingChar(null);
            if (deleted) {
              setSituation({
                ...situation,
                characters: situation.characters.filter((c) => c.id !== editingChar.id),
              });
            } else if (updated) {
              setSituation({
                ...situation,
                characters: situation.characters.map((c) => (c.id === updated.id ? updated : c)),
              });
            }
          }}
        />
      )}
    </main>
  );
}

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1">
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
  const [loading, setLoading] = useState(false);
  useEffect(() => setLocal(value), [value]);
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
        <label className="label">{label}</label>
        <button className="text-[11px]" style={{ color: "var(--c-accent)" }} onClick={runAi} disabled={loading}>
          {loading ? "…" : "✦ AIに書き直してもらう"}
        </button>
      </div>
      {textarea ? (
        <textarea
          className="input h-32"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => onSave(local)}
        />
      ) : (
        <input
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

function CharacterEditor({
  situationId,
  character,
  canDelete,
  onClose,
}: {
  situationId: string;
  character: Character;
  canDelete: boolean;
  onClose: (updated: Character | null, deleted?: boolean) => void;
}) {
  const [c, setC] = useState<Character>(character);
  const save = async () => {
    const r = await fetch(`/api/situations/${situationId}/characters/${c.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: c.name,
        personality: c.personality,
        speechStyle: c.speechStyle,
        relationship: c.relationship,
        exampleDialogs: c.exampleDialogs,
        sortOrder: c.sortOrder,
      }),
    });
    onClose(r.ok ? { ...c, ...(await r.json()) } : null);
  };
  const genSamples = async () => {
    const r = await fetch(`/api/situations/${situationId}/characters/${c.id}/sample-dialogs`, {
      method: "POST",
    });
    if (r.ok) {
      const { dialogs } = await r.json();
      setC({ ...c, exampleDialogs: [...(c.exampleDialogs ?? []), ...dialogs].slice(0, 5) });
    }
  };
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ background: "var(--c-bg)" }}>
      <div className="mx-auto max-w-[var(--shell-max)] px-5 py-6">
        <button className="text-sm" onClick={() => onClose(null)}>
          ← 作成にもどる
        </button>
        <h2 className="mt-3 text-lg font-bold">キャラ編集</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="cname">
              名前
            </label>
            <input id="cname" className="input" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={c.sortOrder === 0} onChange={() => setC({ ...c, sortOrder: 0 })} /> 主演
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={c.sortOrder !== 0} onChange={() => setC({ ...c, sortOrder: 1 })} /> 脇役
            </label>
          </div>
          <div>
            <label className="label" htmlFor="cpers">
              性格
            </label>
            <textarea id="cpers" className="input h-24" value={c.personality} onChange={(e) => setC({ ...c, personality: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="cspeech">
              口調・話し方
            </label>
            <textarea
              id="cspeech"
              className="input h-20"
              placeholder="一人称、語尾、敬語/タメ口、呼び方"
              value={c.speechStyle}
              onChange={(e) => setC({ ...c, speechStyle: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="crel">
              主人公との関係
            </label>
            <textarea id="crel" className="input h-20" value={c.relationship} onChange={(e) => setC({ ...c, relationship: e.target.value })} />
          </div>
          <div>
            <p className="label">会話例(最大5組)</p>
            {(c.exampleDialogs ?? []).map((d, i) => (
              <div key={i} className="mb-1 flex gap-1">
                <input
                  className="input text-xs"
                  placeholder="あなた"
                  value={d.user}
                  onChange={(e) => {
                    const ex = [...c.exampleDialogs];
                    ex[i] = { ...d, user: e.target.value };
                    setC({ ...c, exampleDialogs: ex });
                  }}
                />
                <input
                  className="input text-xs"
                  placeholder="キャラ"
                  value={d.char}
                  onChange={(e) => {
                    const ex = [...c.exampleDialogs];
                    ex[i] = { ...d, char: e.target.value };
                    setC({ ...c, exampleDialogs: ex });
                  }}
                />
              </div>
            ))}
            {(c.exampleDialogs?.length ?? 0) < 5 && (
              <button
                className="mt-1 text-xs"
                style={{ color: "var(--c-accent)" }}
                onClick={() => setC({ ...c, exampleDialogs: [...(c.exampleDialogs ?? []), { user: "", char: "" }] })}
              >
                ＋ 追加
              </button>
            )}
            <button className="ml-3 mt-1 text-xs" style={{ color: "var(--c-accent)" }} onClick={genSamples}>
              ✦ 口調サンプルをAIに作らせる
            </button>
          </div>
          <button className="btn-primary w-full" onClick={save}>
            保存して戻る
          </button>
          {canDelete && (
            <button
              className="w-full text-center text-xs"
              style={{ color: "var(--c-danger)" }}
              onClick={async () => {
                await fetch(`/api/situations/${situationId}/characters/${c.id}`, { method: "DELETE" });
                onClose(null, true);
              }}
            >
              このキャラを削除
            </button>
          )}
        </div>
      </div>
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
