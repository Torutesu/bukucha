"use client";
import {
  ChevronDown,
  CircleAlert,
  Eye,
  ImagePlus,
  PartyPopper,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { postSse } from "@/components/sse-client";
import {
  MOODS,
  WRITING_STYLES,
  parseLore,
  parseStyle,
  type LoreEntry,
  type PlotStyle,
} from "@/lib/plot-style";

interface Character {
  id: string;
  name: string;
  personality: string;
  speechStyle: string;
  relationship: string;
  profileImageUrl: string | null;
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
  coverImageUrl: string | null;
  contentLevel: "ALL_AGES" | "R15";
  style: PlotStyle;
  lore: LoreEntry[];
  commentsEnabled: boolean;
  creatorComment: string | null;
  characters: Character[];
  intros: Intro[];
  tags: { tag: { id: string; name: string } }[];
}

type TabKey = "prompt" | "lore" | "style" | "intro" | "about" | "settings";
const TABS: { key: TabKey; label: string; required?: boolean }[] = [
  { key: "prompt", label: "プロンプト", required: true },
  { key: "lore", label: "設定集" },
  { key: "style", label: "スタイル" },
  { key: "intro", label: "イントロ", required: true },
  { key: "about", label: "紹介" },
  { key: "settings", label: "設定" },
];

const PROMPT_LIMIT = 2400;
const INTRO_LIMIT = 1500;

function CreateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [situation, setSituation] = useState<Situation | null>(null);
  const [tab, setTab] = useState<TabKey>("prompt");
  const [fantasy, setFantasy] = useState(params.get("fantasy") ?? "");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState(false);
  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([]);
  const [notice, setNotice] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [options, setOptions] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testMessages, setTestMessages] = useState<{ role: "USER" | "AI"; content: string }[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testGenerating, setTestGenerating] = useState(false);
  const [testStream, setTestStream] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<
    { status: string } | { blocked: { kind: string; detail: string }[] } | null
  >(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // 保存は直列化する。並行PATCHだと到着順が入れ替わり、後の変更が古い値で上書きされうる
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const track = (run: () => Promise<unknown>): Promise<unknown> => {
    const next = saveChain.current.then(run, run);
    saveChain.current = next.catch(() => {});
    return next;
  };
  const flushSaves = () => saveChain.current;

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
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
        .then((d) => d && openEditor(d));
    }
    if (params.get("blank") || params.get("situationId")) return;
    fetch("/api/me").then((r) => {
      if (r.status === 401) router.replace(`/login?returnTo=${encodeURIComponent("/create")}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function normalize(d: Situation): Situation {
    return {
      ...d,
      style: parseStyle(d.style),
      lore: parseLore(d.lore),
      characters: d.characters.map((c) => ({
        ...c,
        exampleDialogs: Array.isArray(c.exampleDialogs) ? c.exampleDialogs : [],
      })),
    };
  }

  function openEditor(d: Situation) {
    setSituation(normalize(d));
    // 初回のみ注意事項シートを出す
    if (!localStorage.getItem("bukucha_plot_notice")) setNotice(true);
  }

  const patch = useCallback(
    async (data: Record<string, unknown>) => {
      if (!situation) return;
      setSituation({ ...situation, ...data } as Situation);
      await track(() =>
        fetch(`/api/situations/${situation.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        })
      );
    },
    [situation]
  );

  const patchStyle = (part: Partial<PlotStyle>) => {
    if (!situation) return;
    patch({ style: { ...situation.style, ...part } });
  };

  const patchChar = async (cid: string, data: Record<string, unknown>) => {
    if (!situation) return;
    setSituation({
      ...situation,
      characters: situation.characters.map((c) => (c.id === cid ? { ...c, ...data } : c)),
    } as Situation);
    await track(() =>
      fetch(`/api/situations/${situation.id}/characters/${cid}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      })
    );
  };

  const patchIntro = async (iid: string, data: Record<string, unknown>) => {
    if (!situation) return;
    setSituation({
      ...situation,
      intros: situation.intros.map((i) => (i.id === iid ? { ...i, ...data } : i)),
    } as Situation);
    await track(() =>
      fetch(`/api/situations/${situation.id}/intros/${iid}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      })
    );
  };

  const upload = async (file: File): Promise<string | null> => {
    const form = new FormData();
    form.append("file", file);
    const r = await fetch("/api/uploads", { method: "POST", body: form });
    if (!r.ok) {
      notify("アップロードに失敗しました");
      return null;
    }
    return (await r.json()).url as string;
  };

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
      openEditor(await r.json());
    } catch {
      setDraftError(true);
    } finally {
      setDrafting(false);
    }
  };

  const startBlank = async () => {
    const r = await fetch("/api/situations", { method: "POST" });
    if (r.ok) openEditor(await r.json());
  };

  const runTest = async () => {
    if (!situation || testGenerating || !testInput.trim()) return;
    await flushSaves();
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
    if (!r.ok || j.error) setPublishError(j?.error?.message ?? "公開できませんでした");
    else setPublishResult(j);
    setPublishing(false);
  };

  // ---- 入口: 妄想入力 ----
  if (!situation) {
    return (
      <main className="flex min-h-dvh flex-col px-5 py-8">
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
        <button
          className="mt-3 text-center text-xs underline"
          style={{ color: "var(--c-textMuted)" }}
          onClick={startBlank}
        >
          白紙から作る
        </button>
      </main>
    );
  }

  // ---- 必須項目の充足チェック(タブの❗表示と「完成」の可否) ----
  const promptOk =
    situation.title.trim().length > 0 &&
    situation.worldSetting.trim().length > 0 &&
    situation.characters.some((c) => c.name.trim());
  const introOk = situation.intros.some((i) => i.introText.trim() || i.firstMessage.trim());
  const tabError: Record<string, boolean> = { prompt: !promptOk, intro: !introOk };

  const promptChars =
    situation.title.length +
    situation.worldSetting.length +
    situation.characters.reduce(
      (n, c) => n + c.name.length + c.personality.length + c.speechStyle.length + c.relationship.length,
      0
    );

  // ---- 公開完了 ----
  if (publishResult && "status" in publishResult && publishResult.status === "PUBLISHED") {
    return (
      <main className="flex min-h-dvh flex-col justify-center px-6">
        <div className="card p-6 text-center">
          <p className="text-lg font-bold">
            <PartyPopper size={18} className="mr-1.5 inline align-[-3px]" style={{ color: "var(--c-primary)" }} />{" "}
            公開しました
          </p>
          <Link href={`/s/${situation.id}`} className="btn-primary mt-4 block">
            作品ページを見る
          </Link>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`「${situation.title}」を書きました`)}`}
            target="_blank"
            className="mt-3 block text-xs underline"
            style={{ color: "var(--c-textMuted)" }}
          >
            Xでシェア
          </a>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ヘッダー */}
      <header className="sticky top-0 z-20 flex h-12 items-center gap-1 px-2" style={{ background: "var(--c-bg)" }}>
        <button
          aria-label="閉じる"
          className="icon-btn"
          onClick={async () => {
            await flushSaves();
            router.push("/studio");
          }}
        >
          <X size={20} />
        </button>
        <h1 className="flex-1 text-base font-bold">プロット</h1>
        <button
          className="btn-ghost px-3 py-1.5 text-xs"
          onClick={async () => {
            await flushSaves();
            notify("一時保存しました");
          }}
        >
          一時保存
        </button>
        <button
          className="btn-primary px-3 py-1.5 text-xs disabled:opacity-40"
          disabled={publishing || !promptOk || !introOk}
          onClick={() => publish("PUBLISHED")}
        >
          {publishing ? "…" : "完成"}
        </button>
      </header>

      {/* タブ */}
      <div
        className="hide-scrollbar sticky top-12 z-20 flex gap-4 overflow-x-auto border-b px-4"
        style={{ background: "var(--c-bg)", borderColor: "var(--c-border)" }}
        data-testid="plot-tabs"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            data-testid={`plot-tab-${t.key}`}
            className="shrink-0 whitespace-nowrap py-2.5 text-sm font-semibold"
            style={{
              color: tab === t.key ? "var(--c-text)" : "var(--c-textMuted)",
              boxShadow: tab === t.key ? "inset 0 -2px 0 var(--c-primary)" : "none",
            }}
            onClick={() => setTab(t.key)}
          >
            {t.required && <span style={{ color: "var(--c-primary)" }}>*</span>}
            {t.label}
            {tabError[t.key] && (
              <CircleAlert size={13} className="ml-1 inline align-[-2px]" style={{ color: "var(--c-danger)" }} />
            )}
          </button>
        ))}
      </div>

      <main className="flex-1 px-4 pb-28 pt-3">
        {/* ============ プロンプト ============ */}
        {tab === "prompt" && (
          <div className="space-y-5">
            <p className="text-center text-xs" style={{ color: "var(--c-textMuted)" }}>
              {promptChars.toLocaleString()}/{PROMPT_LIMIT.toLocaleString()}字
            </p>

            <section>
              <h2 className="mb-2 text-sm font-bold">基本設定</h2>
              <div className="card space-y-4 p-3">
                <Field
                  label="題名"
                  required
                  value={situation.title}
                  maxLength={40}
                  placeholder="例) この夏、私たち幼馴染じゃいられない"
                  onSave={(v) => patch({ title: v })}
                />
                <Field
                  label="説明"
                  required
                  textarea
                  rows={5}
                  value={situation.worldSetting}
                  maxLength={2000}
                  placeholder="状況、関係性、世界観等を説明してください"
                  onSave={(v) => patch({ worldSetting: v })}
                  aiField="worldSetting"
                  situationId={situation.id}
                />
                <button
                  className="btn-ghost mx-auto flex items-center gap-1 px-4 py-1.5 text-xs"
                  onClick={() => setOptions((o) => !o)}
                >
                  オプション設定
                  <ChevronDown size={13} style={{ transform: options ? "scaleY(-1)" : "none" }} />
                </button>
                {options && (
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
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-bold">キャラクター</h2>
              <div className="space-y-3">
                {situation.characters
                  .slice()
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((c) => (
                    <div key={c.id} data-testid="character-item" className="card space-y-3 p-3">
                      <div className="flex justify-center">
                        <ImagePicker
                          url={c.profileImageUrl}
                          label="キャラクターイメージ"
                          onPick={async (f) => {
                            const url = await upload(f);
                            if (url) patchChar(c.id, { profileImageUrl: url });
                          }}
                        />
                      </div>
                      <Field
                        label="名前"
                        required
                        value={c.name}
                        maxLength={10}
                        placeholder="短い方がみんな呼びやすいかも…? 例) ヤマト"
                        onSave={(v) => patchChar(c.id, { name: v })}
                      />
                      <Field
                        label="プロフィール"
                        textarea
                        rows={4}
                        value={c.personality}
                        maxLength={1000}
                        placeholder="外見的特徴、性格、趣味などを記入すると、より個性溢れるキャラクターを作れます!"
                        onSave={(v) => patchChar(c.id, { personality: v })}
                      />
                      <Field
                        label="口調・話し方"
                        value={c.speechStyle}
                        maxLength={200}
                        placeholder="例) 一人称は俺。命令形が多い。"
                        onSave={(v) => patchChar(c.id, { speechStyle: v })}
                      />
                      <Field
                        label="主人公との関係"
                        value={c.relationship}
                        maxLength={200}
                        placeholder="例) 契約結婚の相手"
                        onSave={(v) => patchChar(c.id, { relationship: v })}
                      />
                      <div className="flex items-center justify-between">
                        <Link
                          href={`/create/${situation.id}/characters/${c.id}`}
                          className="text-xs underline"
                          style={{ color: "var(--c-textMuted)" }}
                        >
                          会話例を編集
                        </Link>
                        {situation.characters.length > 1 && (
                          <button
                            aria-label={`${c.name}を削除`}
                            className="text-xs"
                            style={{ color: "var(--c-danger)" }}
                            onClick={async () => {
                              if (!confirm(`${c.name}を削除しますか?`)) return;
                              await fetch(`/api/situations/${situation.id}/characters/${c.id}`, {
                                method: "DELETE",
                              });
                              setSituation({
                                ...situation,
                                characters: situation.characters.filter((x) => x.id !== c.id),
                              });
                            }}
                          >
                            <Trash2 size={13} className="mr-1 inline align-[-2px]" />
                            削除
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                {situation.characters.length < 5 && (
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
                        setSituation({
                          ...situation,
                          characters: [...situation.characters, { ...c, exampleDialogs: [] }],
                        });
                      }
                    }}
                  >
                    <Plus size={15} className="mr-1 inline align-[-2px]" /> キャラクターを追加 (
                    {situation.characters.length}/5)
                  </button>
                )}
              </div>
            </section>

            <p className="pt-2 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
              ※著作権の侵害、過度な性的設定など非倫理的なプロットは削除対象となります{" "}
              <Link href="/legal/guideline" className="underline">
                詳しく
              </Link>
            </p>
          </div>
        )}

        {/* ============ 設定集 ============ */}
        {tab === "lore" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold">設定集を連動してください</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--c-textMuted)" }}>
                設定集に登録したキーワードが言及されると、作成した内容がAIに伝達されます
              </p>
            </div>
            {situation.lore.map((e, i) => (
              <div key={e.id} data-testid="lore-item" className="card space-y-3 p-3">
                <Field
                  label="キーワード"
                  value={e.keyword}
                  maxLength={30}
                  placeholder="例) 銀の懐中時計"
                  onSave={(v) => {
                    const lore = [...situation.lore];
                    lore[i] = { ...e, keyword: v };
                    patch({ lore });
                  }}
                />
                <Field
                  label="内容"
                  textarea
                  rows={3}
                  value={e.content}
                  maxLength={1000}
                  placeholder="このキーワードが出たときにAIへ伝える設定"
                  onSave={(v) => {
                    const lore = [...situation.lore];
                    lore[i] = { ...e, content: v };
                    patch({ lore });
                  }}
                />
                <button
                  className="text-xs"
                  style={{ color: "var(--c-danger)" }}
                  onClick={() => patch({ lore: situation.lore.filter((x) => x.id !== e.id) })}
                >
                  <Trash2 size={13} className="mr-1 inline align-[-2px]" />
                  削除
                </button>
              </div>
            ))}
            {situation.lore.length < 5 && (
              <button
                className="btn-ghost w-full text-sm"
                onClick={() =>
                  patch({
                    lore: [
                      ...situation.lore,
                      { id: `lore${situation.lore.length + 1}_${situation.id.slice(-4)}`, keyword: "", content: "" },
                    ],
                  })
                }
              >
                <Plus size={15} className="mr-1 inline align-[-2px]" /> 設定集を追加 ({situation.lore.length}/5)
              </button>
            )}
          </div>
        )}

        {/* ============ スタイル ============ */}
        {tab === "style" && (
          <div className="space-y-6">
            <h2 className="text-base font-bold">スタイルを自由に調整!</h2>

            <section>
              <h3 className="mb-2 text-sm font-bold">プレイシステム</h3>
              <div className="card divide-y p-0" style={{ borderColor: "var(--c-border)" }}>
                <Toggle
                  label="ユーザーターンに選択肢を提供"
                  on={situation.style.choices}
                  onChange={(v) => patchStyle({ choices: v })}
                />
                <Toggle
                  label="背景のインフォボックス"
                  on={situation.style.infoboxBg}
                  onChange={(v) => patchStyle({ infoboxBg: v })}
                />
                <Toggle
                  label="キャラのインフォボックス"
                  on={situation.style.infoboxChar}
                  onChange={(v) => patchStyle({ infoboxChar: v })}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-bold">進行方式</h3>
              <div className="card space-y-4 p-3">
                <Choice
                  label="難易度"
                  hint={{
                    easy: "キャラクターは主人公に好意的です",
                    normal: "キャラクターがそれぞれの性格と状況に合わせて自然に行動します",
                    hard: "簡単には心を開きません",
                    extreme: "極めて頑なで、関係の進展は重くなります",
                  }}
                  options={[
                    ["easy", "簡単"],
                    ["normal", "普通"],
                    ["hard", "難しい"],
                    ["extreme", "極限"],
                  ]}
                  value={situation.style.difficulty}
                  onChange={(v) => patchStyle({ difficulty: v as PlotStyle["difficulty"] })}
                />
                <Choice
                  label="展開速度"
                  hint={{
                    fast: "1応答ごとに状況が大きく動きます",
                    natural: "物語に合わせて緩急を調整します",
                    slow: "心情と間の描写を厚くします",
                  }}
                  options={[
                    ["fast", "速い"],
                    ["natural", "自然"],
                    ["slow", "遅い"],
                  ]}
                  value={situation.style.pace}
                  onChange={(v) => patchStyle({ pace: v as PlotStyle["pace"] })}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-bold">ストーリー演出</h3>
              <div className="card space-y-4 p-3">
                <Choice
                  label="ナレーション視点"
                  hint={{
                    first: "主人公の内側から描写します",
                    second: "「あなた」に語りかける視点で描写します",
                    third: "客観的視点で描写します",
                  }}
                  options={[
                    ["first", "一人称"],
                    ["second", "二人称"],
                    ["third", "三人称"],
                  ]}
                  value={situation.style.pov}
                  onChange={(v) => patchStyle({ pov: v as PlotStyle["pov"] })}
                />
                <Choice
                  label="時制"
                  hint={{ past: "過去形(〜した)で描写します", present: "現在形(〜する)で描写します" }}
                  options={[
                    ["past", "過去形"],
                    ["present", "現在系"],
                  ]}
                  value={situation.style.tense}
                  onChange={(v) => patchStyle({ tense: v as PlotStyle["tense"] })}
                />
                <Choice
                  label="応答の長さ"
                  hint={{
                    short: "150〜250字で簡潔に描写します",
                    medium: "300〜450字で描写します",
                    long: "500〜800字でたっぷり描写します",
                    auto: "物語の流れに合わせて自然に調整します",
                  }}
                  options={[
                    ["short", "短い"],
                    ["medium", "中間"],
                    ["long", "長い"],
                    ["auto", "自動"],
                  ]}
                  value={situation.style.length}
                  onChange={(v) => patchStyle({ length: v as PlotStyle["length"] })}
                />
                <Choice
                  label="表現方式"
                  hint={{
                    dialogue: "会話のテンポを重視します",
                    balanced: "セリフと行動のバランスを適切に保ちます",
                    action: "行動と情景の描写を厚くします",
                  }}
                  options={[
                    ["dialogue", "会話多め"],
                    ["balanced", "基本"],
                    ["action", "行動多め"],
                  ]}
                  value={situation.style.expression}
                  onChange={(v) => patchStyle({ expression: v as PlotStyle["expression"] })}
                />
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-bold">
                雰囲気 <span className="text-xs font-normal" style={{ color: "var(--c-textMuted)" }}>(最大2種選択可能)</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {MOODS.map((m) => {
                  const on = situation.style.moods.includes(m);
                  return (
                    <button
                      key={m}
                      className="chip"
                      data-on={on}
                      onClick={() => {
                        const moods = on
                          ? situation.style.moods.filter((x) => x !== m)
                          : [...situation.style.moods, m].slice(-2);
                        patchStyle({ moods });
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-bold">文章スタイル</h3>
              <div className="grid grid-cols-2 gap-2">
                {[...WRITING_STYLES, ""].map((w) => (
                  <button
                    key={w || "none"}
                    className="rounded-[12px] border py-2.5 text-sm"
                    style={{
                      borderColor:
                        situation.style.writingStyle === w ? "var(--c-primary)" : "var(--c-border)",
                      background:
                        situation.style.writingStyle === w ? "var(--c-primarySoft)" : "transparent",
                    }}
                    onClick={() => patchStyle({ writingStyle: w })}
                  >
                    {w || "設定しない"}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ============ イントロ ============ */}
        {tab === "intro" && (
          <div className="space-y-4">
            <h2 className="text-base font-bold">ストーリーの始まりを入力!</h2>
            <p className="text-xs" style={{ color: "var(--c-textMuted)" }}>
              {"{{user}}"} と書くと、読者のトークプロフィール名に置き換わります
            </p>
            {situation.intros.map((iv) => (
              <div key={iv.id} className="card space-y-3 p-3">
                <Field
                  label="ラベル"
                  value={iv.label}
                  maxLength={30}
                  placeholder="例) 雨の帰り道で"
                  onSave={(v) => patchIntro(iv.id, { label: v })}
                />
                <Field
                  label="導入の地の文"
                  textarea
                  rows={4}
                  value={iv.introText}
                  maxLength={INTRO_LIMIT}
                  placeholder="*状況を説明してください*"
                  insertToken="{{user}}"
                  onSave={(v) => patchIntro(iv.id, { introText: v })}
                />
                <Field
                  label="最初の返答"
                  textarea
                  rows={4}
                  value={iv.firstMessage}
                  maxLength={INTRO_LIMIT}
                  placeholder="キャラクターの第一声(地の文+「セリフ」)"
                  insertToken="{{user}}"
                  onSave={(v) => patchIntro(iv.id, { firstMessage: v })}
                />
                {situation.intros.length > 1 && (
                  <button
                    className="text-xs"
                    style={{ color: "var(--c-danger)" }}
                    onClick={async () => {
                      if (!confirm(`「${iv.label}」を削除しますか?`)) return;
                      await fetch(`/api/situations/${situation.id}/intros/${iv.id}`, { method: "DELETE" });
                      setSituation({ ...situation, intros: situation.intros.filter((x) => x.id !== iv.id) });
                    }}
                  >
                    <Trash2 size={13} className="mr-1 inline align-[-2px]" />
                    削除
                  </button>
                )}
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
                <Plus size={15} className="mr-1 inline align-[-2px]" /> はじまりを追加 (
                {situation.intros.length}/3)
              </button>
            )}

            <button className="btn-ghost w-full text-sm" onClick={() => setTestOpen(true)}>
              <Eye size={14} className="mr-1 inline align-[-2px]" /> この口調をテストする
            </button>
          </div>
        )}

        {/* ============ 紹介 ============ */}
        {tab === "about" && (
          <div className="space-y-5">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold">カバー</h2>
                <Link href={`/s/${situation.id}`} className="btn-ghost px-3 py-1.5 text-xs">
                  <Eye size={13} className="mr-1 inline align-[-2px]" /> プレビュー
                </Link>
              </div>
              <div className="card space-y-4 p-3">
                <div className="flex justify-center">
                  <ImagePicker
                    url={situation.coverImageUrl}
                    label="カバーイメージ"
                    onPick={async (f) => {
                      const url = await upload(f);
                      if (url) patch({ coverImageUrl: url });
                    }}
                  />
                </div>
                <Field
                  label="簡単な紹介"
                  textarea
                  rows={2}
                  value={situation.catchphrase}
                  maxLength={40}
                  placeholder="題名と一緒に公開される紹介文を入力!"
                  onSave={(v) => patch({ catchphrase: v })}
                  aiField="catchphrase"
                  situationId={situation.id}
                />
                <div>
                  <p className="label">ハッシュタグ</p>
                  <p className="mb-2 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                    タグをつけると、見つけてもらえる確率UP!({situation.tags.length}/6)
                  </p>
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
                            patch({ tags: next, tagIds: next.map((n) => n.tag.id) } as Record<string, unknown>);
                          }}
                        >
                          #{t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-bold">追加情報</h2>
              <div className="card divide-y p-0" style={{ borderColor: "var(--c-border)" }}>
                <Toggle
                  label="クリエイターコメントを使用"
                  hint="他のユーザー向けにコメントを記入してください"
                  on={situation.creatorComment !== null}
                  onChange={(v) => patch({ creatorComment: v ? "" : null })}
                />
              </div>
              {situation.creatorComment !== null && (
                <div className="card mt-2 p-3">
                  <Field
                    label="クリエイターコメント"
                    textarea
                    rows={3}
                    value={situation.creatorComment}
                    maxLength={500}
                    placeholder="読者へのひとこと"
                    onSave={(v) => patch({ creatorComment: v })}
                  />
                </div>
              )}
            </section>
          </div>
        )}

        {/* ============ 設定 ============ */}
        {tab === "settings" && (
          <div className="space-y-5">
            <section>
              <h2 className="mb-2 text-sm font-bold">作成オプション</h2>
              <div className="card p-3">
                <p className="text-sm font-semibold">他のユーザーにプロットを公開する</p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                  「完成」で公開されます。非公開のまま保存することもできます
                </p>
                <button
                  className="btn-ghost mt-3 w-full text-sm"
                  disabled={publishing}
                  onClick={() => publish("PRIVATE")}
                >
                  非公開で保存する
                </button>
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-bold">コメント設定</h2>
              <div className="card p-0">
                <Toggle
                  label="コメントの投稿を許可"
                  hint="ユーザーがこのプロットにコメントを残せるようになります"
                  on={situation.commentsEnabled}
                  onChange={(v) => patch({ commentsEnabled: v })}
                />
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-bold">危険な操作</h2>
              <button
                className="card w-full p-3 text-left text-sm"
                style={{ color: "var(--c-danger)" }}
                onClick={async () => {
                  if (!confirm("このプロットを削除しますか?")) return;
                  await fetch(`/api/situations/${situation.id}`, { method: "DELETE" });
                  router.push("/studio");
                }}
              >
                <Trash2 size={14} className="mr-1.5 inline align-[-2px]" />
                プロットを削除
              </button>
            </section>
          </div>
        )}

        {publishError && (
          <div data-testid="publish-error" className="card mt-4 p-3 text-sm" style={{ borderColor: "var(--c-danger)" }}>
            {publishError}
          </div>
        )}
        {publishResult && "blocked" in publishResult && (
          <div data-testid="moderation-error" className="card mt-4 p-3 text-sm" style={{ borderColor: "var(--c-danger)" }}>
            {publishResult.blocked.map((b, i) => (
              <p key={i} className="mb-1">
                {b.detail}
              </p>
            ))}
            <button className="btn-ghost mt-2 w-full py-2 text-xs" onClick={() => setTab("prompt")}>
              プロンプトを直す
            </button>
          </div>
        )}
      </main>

      {/* 注意事項シート(初回のみ) */}
      {notice && (
        <div className="backdrop fixed inset-0 z-40 flex items-end bg-black/50">
          <div className="card sheet-up mx-auto w-full max-w-[var(--shell-max)] rounded-b-none p-5 pb-8">
            <p className="text-lg font-bold leading-snug">プロット作成に関する注意事項をご確認ください</p>
            <div className="mt-3 space-y-2 text-xs leading-relaxed" style={{ color: "var(--c-textMuted)" }}>
              <p>
                次のような
                <Link href="/legal/guideline" className="underline" style={{ color: "var(--c-primary)" }}>
                  運営規約
                </Link>
                の違反が確認されるプロットを作成した場合、プロット削除および、作成制限等の処置がとられる場合がございます。
              </p>
              <p>・過度な性的設定(成人向け)や、過度に攻撃的、差別的な内容の場合</p>
              <p>・著作権、肖像権などの他人の権利を侵害している場合</p>
              <p>・その他ディープフェイクやフェイクニュース、未成年者の性的対象化など、違法または非倫理的な内容の場合</p>
              <p>運営規約の違反が繰り返し確認される場合は、制限期間が延長される場合があります。</p>
            </div>
            <button
              className="btn-primary mt-4 w-full"
              onClick={() => {
                localStorage.setItem("bukucha_plot_notice", "1");
                setNotice(false);
              }}
            >
              確認しました
            </button>
          </div>
        </div>
      )}

      {/* テスト会話 */}
      {testOpen && (
        <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "var(--c-bg)" }}>
          <header className="flex h-12 items-center gap-1 px-2">
            <button aria-label="テストを閉じる" className="icon-btn" onClick={() => setTestOpen(false)}>
              <X size={20} />
            </button>
            <p className="flex-1 text-sm font-bold">この口調でOK?(保存されません)</p>
          </header>
          <div className="novel flex-1 space-y-3 overflow-y-auto px-4 py-3">
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
          <div className="flex gap-2 px-4 pb-6 pt-2">
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
        </div>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex justify-center">
          <span className="rounded-full bg-black/80 px-4 py-2 text-xs text-white">{toast}</span>
        </div>
      )}
    </div>
  );
}

/** 入力フィールド(ローカル編集→blurで保存、文字数カウンタ・AI書き直し・トークン挿入付き) */
function Field({
  label,
  value,
  onSave,
  textarea,
  rows = 3,
  maxLength,
  placeholder,
  required,
  insertToken,
  aiField,
  situationId,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  textarea?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
  insertToken?: string;
  aiField?: string;
  situationId?: string;
}) {
  const [local, setLocal] = useState(value);
  const [synced, setSynced] = useState(value);
  const [loading, setLoading] = useState(false);
  const id = `f-${label}-${(situationId ?? "") + label}`.replace(/\s/g, "");
  // 外部(AI下書き等)でvalueが変わったらレンダー中に追従させる
  if (synced !== value) {
    setSynced(value);
    setLocal(value);
  }

  const runAi = async () => {
    if (!aiField || !situationId) return;
    setLoading(true);
    const r = await fetch(`/api/situations/${situationId}/rewrite-field`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ field: aiField }),
    });
    if (r.ok) {
      const { text } = await r.json();
      setLocal(text);
      onSave(text);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label" htmlFor={id}>
          {required && <span style={{ color: "var(--c-primary)" }}>*</span>}
          {label}
        </label>
        <div className="flex items-center gap-3">
          {insertToken && (
            <button
              className="rounded-full px-2 py-0.5 text-[11px]"
              style={{ background: "var(--c-primarySoft)", color: "var(--c-primary)" }}
              onClick={() => {
                const next = local + insertToken;
                setLocal(next);
                onSave(next);
              }}
            >
              {insertToken}
            </button>
          )}
          {aiField && (
            <button
              className="text-[11px]"
              style={{ color: "var(--c-accent)" }}
              onClick={runAi}
              disabled={loading}
            >
              {loading ? "…" : (
                <>
                  <Sparkles size={13} className="mr-1 inline align-[-2px]" /> AIに書き直してもらう
                </>
              )}
            </button>
          )}
        </div>
      </div>
      {textarea ? (
        <textarea
          id={id}
          className="input"
          style={{ height: `${rows * 1.6 + 1.4}rem` }}
          maxLength={maxLength}
          placeholder={placeholder}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => local !== value && onSave(local)}
        />
      ) : (
        <input
          id={id}
          className="input"
          maxLength={maxLength}
          placeholder={placeholder}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => local !== value && onSave(local)}
        />
      )}
      {maxLength && (
        <p className="mt-0.5 text-right text-[11px]" style={{ color: "var(--c-textMuted)" }}>
          {local.length}/{maxLength}
        </p>
      )}
    </div>
  );
}

function ImagePicker({
  url,
  label,
  onPick,
}: {
  url: string | null;
  label: string;
  onPick: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        aria-label={label}
        className="flex h-32 w-24 flex-col items-center justify-center gap-1 rounded-[12px] border border-dashed text-[11px]"
        style={{ borderColor: "var(--c-primary)", color: "var(--c-textMuted)" }}
        onClick={() => ref.current?.click()}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full rounded-[12px] object-cover" />
        ) : (
          <>
            <ImagePlus size={20} />
            {label}
          </>
        )}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
      />
    </>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3">
      <span className="flex-1">
        <span className="block text-sm">{label}</span>
        {hint && (
          <span className="mt-0.5 block text-[11px]" style={{ color: "var(--c-textMuted)" }}>
            {hint}
          </span>
        )}
      </span>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: on ? "var(--c-primary)" : "var(--c-border)" }}
        onClick={() => onChange(!on)}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: on ? "1.375rem" : "0.125rem" }}
        />
      </button>
    </div>
  );
}

function Choice({
  label,
  options,
  value,
  hint,
  onChange,
}: {
  label: string;
  options: [string, string][];
  value: string;
  hint?: Record<string, string>;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex gap-2">
        {options.map(([v, l]) => (
          <button
            key={v}
            className="flex-1 rounded-[10px] border py-2 text-sm"
            style={{
              borderColor: value === v ? "var(--c-primary)" : "var(--c-border)",
              background: value === v ? "var(--c-primarySoft)" : "transparent",
            }}
            onClick={() => onChange(v)}
          >
            {l}
          </button>
        ))}
      </div>
      {hint?.[value] && (
        <p className="mt-1 text-[11px]" style={{ color: "var(--c-primary)" }}>
          {hint[value]}
        </p>
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
