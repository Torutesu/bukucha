"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postSse } from "./sse-client";

export interface ReaderMessage {
  idx: number;
  role: "USER" | "AI" | "SYSTEM";
  content: string;
  choices?: { id: string; text: string }[] | null;
}

interface GuestStory {
  situationId: string;
  introVariantId: string;
  title: string;
  introText: string;
  messages: { role: "USER" | "AI"; content: string }[];
}

interface RouteItem {
  id: string;
  createdAt: string;
  branchedFromStoryId: string | null;
  messages: { idx: number; content: string }[];
}

/** ユーザー入力の *〜* を地の文(em)として描画 */
function UserContent({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("*") && p.endsWith("*") ? <em key={i}>{p.slice(1, -1)}</em> : <span key={i}>{p}</span>
      )}
    </>
  );
}

/** AI応答のノベル組版: 「」セリフを強調、*〜* は地の文(em)扱い */
function AiContent({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*|「[^」]*」)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
        if (p.startsWith("「") && p.endsWith("」"))
          return (
            <span key={i} className="dialogue">
              {p}
            </span>
          );
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

// SCR-006: ノベルリーダー本体
export function StoryReader(props: {
  mode: "auth" | "guest";
  storyId?: string;
  situationId?: string;
  situationTitle?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(props.situationTitle ?? "");
  const [situationId, setSituationId] = useState(props.situationId ?? "");
  const [messages, setMessages] = useState<ReaderMessage[] | null>(null);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [quotaMsg, setQuotaMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const [rewindMode, setRewindMode] = useState(false);
  const [rewindIdx, setRewindIdx] = useState<number | null>(null);
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [userNote, setUserNote] = useState("");
  const [summary, setSummary] = useState("");
  const [savedToast, setSavedToast] = useState(false);
  const [guestGate, setGuestGate] = useState(false);
  // Zeta詳細インタラクション
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestRemaining, setSuggestRemaining] = useState<number | null>(null);
  const [suggestNotice, setSuggestNotice] = useState<string | null>(null);
  const [selectedAiIdx, setSelectedAiIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [routesOpen, setRoutesOpen] = useState(false);
  const [routes, setRoutes] = useState<RouteItem[] | null>(null);
  const [choicesEnabled, setChoicesEnabled] = useState(true);
  const [useMidModel, setUseMidModel] = useState(false);
  const [showLatestChip, setShowLatestChip] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const guestRef = useRef<GuestStory | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pressStartRef = useRef(0);
  const rerollingRef = useRef(false);
  const atBottomRef = useRef(true);
  const lastScrollYRef = useRef(0);
  const programmaticScrollRef = useRef(false);

  // 初期ロード
  useEffect(() => {
    (async () => {
      if (props.mode === "guest") {
        const raw = localStorage.getItem("bukucha_guest_story");
        if (!raw) {
          router.replace("/");
          return;
        }
        const g: GuestStory = JSON.parse(raw);
        guestRef.current = g;
        setTitle(g.title);
        setSituationId(g.situationId);
        const base: ReaderMessage[] = [{ idx: 0, role: "SYSTEM", content: g.introText }];
        if (g.messages.length === 0) {
          // 初回: firstMessageを取得するために1回generate…ではなく詳細から取得
          const r = await fetch(`/api/situations/${g.situationId}`);
          if (r.ok) {
            const d = await r.json();
            const intro = d.intros.find((i: { id: string }) => i.id === g.introVariantId);
            if (intro) {
              g.messages.push({ role: "AI", content: intro.firstMessage });
              localStorage.setItem("bukucha_guest_story", JSON.stringify(g));
            }
          }
        }
        setMessages([
          ...base,
          ...g.messages.map((m, i) => ({ idx: i + 1, role: m.role, content: m.content })),
        ]);
      } else {
        const r = await fetch(`/api/stories/${props.storyId}`);
        if (!r.ok) {
          setErrorMsg("物語を読み込めませんでした");
          setMessages([]);
          return;
        }
        const st = await r.json();
        setTitle(st.situation.title);
        setSituationId(st.situation.id);
        setChoicesEnabled(st.choicesEnabled ?? true);
        setUseMidModel(st.useMidModel ?? false);
        setMessages(
          st.messages.map((m: ReaderMessage & { choices: unknown }) => ({
            idx: m.idx,
            role: m.role,
            content: m.content,
            choices: (m.choices as { id: string; text: string }[] | null) ?? null,
          }))
        );
        setSummary(st.memory?.summary ?? "");
        setUserNote(st.memory?.userNote ?? "");
      }
      // ゲスト→登録引き継ぎ後の入力復元(E2E-002)
      const pending = localStorage.getItem("bukucha_guest_pending");
      if (pending) {
        setInput(pending);
        localStorage.removeItem("bukucha_guest_pending");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode, props.storyId]);

  // スクロール追従: ユーザーが上に戻ったら自動追従を止め「↓最新へ」チップを出す。
  // 下方向スクロールでヘッダーを隠す(没入モード)
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const fromBottom = el.scrollHeight - window.scrollY - window.innerHeight;
      const atBottom = fromBottom < 120;
      atBottomRef.current = atBottom;
      setShowLatestChip(!atBottom);
      const y = window.scrollY;
      // 自動スクロール(送信後・ロード後の追従)ではヘッダーを隠さない
      if (programmaticScrollRef.current) {
        programmaticScrollRef.current = false;
        lastScrollYRef.current = y;
        return;
      }
      setHeaderHidden(y > 56 && y > lastScrollYRef.current + 2);
      if (y < lastScrollYRef.current - 2 || y <= 56) setHeaderHidden(false);
      lastScrollYRef.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToLatest = useCallback(() => {
    programmaticScrollRef.current = true;
    bottomRef.current?.scrollIntoView({ block: "end" });
    atBottomRef.current = true;
    setShowLatestChip(false);
  }, []);

  useEffect(() => {
    if (atBottomRef.current) {
      programmaticScrollRef.current = true;
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages, streamText]);

  const guestUserCount = messages?.filter((m) => m.role === "USER").length ?? 0;

  const send = useCallback(
    async (content: string, selectedChoiceId?: string) => {
      if (generating || !messages) return;
      setBlockedMsg(null);
      setQuotaMsg(null);
      setErrorMsg(null);
      setSuggestions(null);
      setSuggestNotice(null);
      setSelectedAiIdx(null);
      setEditingIdx(null);

      if (props.mode === "guest" && guestUserCount >= 3 && content.trim()) {
        localStorage.setItem("bukucha_guest_pending", content);
        setGuestGate(true);
        return;
      }

      const isContinue = !content.trim() && !selectedChoiceId;
      const maxIdx = messages.length ? messages[messages.length - 1].idx : 0;
      // 直前の選択肢は消費済みにする
      setMessages((prev) =>
        prev!.map((m) => (m.choices ? { ...m, choices: null } : m))
      );
      if (!isContinue) {
        setMessages((prev) => [
          ...prev!,
          { idx: maxIdx + 1, role: "USER", content },
        ]);
      }
      setInput("");
      setGenerating(true);
      setStreamText("");
      // 送信時は最新に追従する(Zeta同様、送った瞬間は必ず最下部へ)
      atBottomRef.current = true;
      setShowLatestChip(false);

      const restore = () => {
        if (!isContinue) {
          setMessages((prev) => prev!.filter((m) => !(m.role === "USER" && m.idx === maxIdx + 1)));
          setInput(content);
        }
      };

      if (props.mode === "guest") {
        const g = guestRef.current!;
        const history = g.messages;
        await postSse(
          "/api/guest/turn",
          {
            situationId: g.situationId,
            introVariantId: g.introVariantId,
            history,
            content,
          },
          {
            onToken: (t) => setStreamText((s) => s + t),
            onBlocked: (msg) => {
              setBlockedMsg(msg);
              restore();
            },
            onError: (code, msg) => {
              setErrorMsg(msg);
              setLastFailedInput(content);
              restore();
            },
            onDone: (d) => {
              const aiContent = d.message?.content ?? "";
              if (content.trim()) g.messages.push({ role: "USER", content });
              g.messages.push({ role: "AI", content: aiContent });
              localStorage.setItem("bukucha_guest_story", JSON.stringify(g));
              setMessages((prev) => [
                ...prev!,
                { idx: (prev![prev!.length - 1]?.idx ?? 0) + 1, role: "AI", content: aiContent },
              ]);
            },
          }
        );
      } else {
        await postSse(
          `/api/stories/${props.storyId}/messages`,
          { content, selectedChoiceId },
          {
            onToken: (t) => setStreamText((s) => s + t),
            onBlocked: (msg) => {
              setBlockedMsg(msg);
              restore();
            },
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
      }
      setStreamText("");
      setGenerating(false);
    },
    [generating, messages, props.mode, props.storyId, guestUserCount]
  );

  const reroll = useCallback(
    async (withInstruction?: string) => {
      if (generating || !messages || props.mode === "guest") return;
      const lastAi = [...messages].reverse().find((m) => m.role === "AI");
      if (!lastAi) return;
      setGenerating(true);
      setStreamText("");
      setSelectedAiIdx(null);
      setEditingIdx(null);
      rerollingRef.current = true;
      // 対象を一旦本文から外す
      setMessages((prev) => prev!.filter((m) => m.idx !== lastAi.idx));
      await postSse(
        `/api/stories/${props.storyId}/messages/${lastAi.idx}/reroll`,
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
              [...prev!, { idx: lastAi.idx, role: "AI" as const, content: d.message!.content, choices: d.message!.choices }].sort(
                (a, b) => a.idx - b.idx
              )
            );
          },
        }
      );
      rerollingRef.current = false;
      setStreamText("");
      setGenerating(false);
    },
    [generating, messages, props.mode, props.storyId]
  );

  const doRewind = async () => {
    if (rewindIdx === null || props.mode === "guest") return;
    const r = await fetch(`/api/stories/${props.storyId}/rewind`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toIdx: rewindIdx }),
    });
    if (r.ok) {
      setMessages((prev) => prev!.filter((m) => m.idx <= rewindIdx));
      setRewindMode(false);
      setRewindIdx(null);
      setSelectedAiIdx(null);
      inputRef.current?.focus();
    }
  };

  // AIF-008: 返信候補
  const fetchSuggestions = useCallback(async () => {
    if (generating || suggestLoading || props.mode === "guest") return;
    setSuggestLoading(true);
    setSuggestNotice(null);
    try {
      const r = await fetch(`/api/stories/${props.storyId}/suggest`, { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setSuggestions(d.suggestions);
        setSuggestRemaining(d.remaining);
      } else {
        setSuggestNotice(d?.error?.message ?? "候補を作れませんでした");
      }
    } catch {
      setSuggestNotice("通信に失敗しました");
    } finally {
      setSuggestLoading(false);
    }
  }, [generating, suggestLoading, props.mode, props.storyId]);

  // AI応答のペン編集
  const startEdit = (m: ReaderMessage) => {
    setEditingIdx(m.idx);
    setEditText(m.content);
    setSelectedAiIdx(null);
  };
  const saveEdit = async () => {
    if (editingIdx === null) return;
    const r = await fetch(`/api/stories/${props.storyId}/messages/${editingIdx}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: editText }),
    });
    if (r.ok) {
      const d = await r.json();
      setMessages((prev) => prev!.map((m) => (m.idx === d.idx ? { ...m, content: d.content } : m)));
      setEditingIdx(null);
    }
  };

  // ここから分岐(並行ルート)
  const branchAt = async (atIdx: number) => {
    const r = await fetch(`/api/stories/${props.storyId}/branch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ atIdx }),
    });
    if (r.ok) {
      const d = await r.json();
      router.push(`/story/${d.id}`);
    }
  };

  const openRoutes = async () => {
    setMenuOpen(false);
    setRoutesOpen(true);
    setRoutes(null);
    const r = await fetch(`/api/stories?situationId=${situationId}`);
    if (r.ok) {
      const d = await r.json();
      setRoutes(d.items);
    }
  };

  const patchStorySetting = async (patch: { choicesEnabled?: boolean; useMidModel?: boolean }) => {
    if (typeof patch.choicesEnabled === "boolean") setChoicesEnabled(patch.choicesEnabled);
    if (typeof patch.useMidModel === "boolean") setUseMidModel(patch.useMidModel);
    await fetch(`/api/stories/${props.storyId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  };

  const lastAiWithChoices = messages
    ? [...messages].reverse().find((m) => m.role === "AI" && m.choices && m.choices.length)
    : undefined;
  const isLatest = lastAiWithChoices && messages && lastAiWithChoices.idx === messages[messages.length - 1].idx;
  const inputHasNarration = /\*[^*]+\*/.test(input);

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--c-novelBg)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-2.5"
        style={{
          background: "color-mix(in oklab, var(--c-novelBg) 92%, transparent)",
          borderColor: "var(--c-border)",
          backdropFilter: "blur(6px)",
          transform: headerHidden && !menuOpen ? "translateY(-110%)" : "translateY(0)",
          transition: "transform 0.25s ease",
        }}
      >
        <button
          aria-label="戻る"
          className="text-lg"
          onClick={() => router.push(props.mode === "guest" ? `/s/${situationId}` : "/bookshelf")}
        >
          ←
        </button>
        <p className="mx-2 flex-1 truncate text-center text-xs" style={{ color: "var(--c-textMuted)" }}>
          {title}
          {useMidModel && (
            <span data-testid="model-chip" className="ml-1" title="高品質モデル">
              🖋
            </span>
          )}
        </p>
        <button aria-label="メニュー" className="text-lg" onClick={() => setMenuOpen(true)}>
          ⋯
        </button>
      </header>

      <main className="flex-1 px-5 py-4">
        <div data-testid="novel-stream" className="novel space-y-4">
          {!messages && (
            <div className="space-y-3 pt-2" aria-label="読み込み中">
              <div className="skeleton mx-auto h-3 w-24" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-11/12" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          )}
          {messages?.map((m) => {
            if (m.role === "SYSTEM")
              return (
                <div key={m.idx} className="fade-in whitespace-pre-wrap opacity-90" data-testid="intro-line">
                  <p className="mb-2 text-center text-xs tracking-widest" style={{ color: "var(--c-textMuted)" }}>
                    ── 導入 ──
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
                      background: rewindMode && rewindIdx === m.idx ? "var(--c-primary)" : "var(--c-userBubble)",
                      color: rewindMode && rewindIdx === m.idx ? "#fff" : "var(--c-novelText)",
                      cursor: rewindMode ? "pointer" : "default",
                      outline: rewindMode ? "1px dashed var(--c-primary)" : "none",
                    }}
                  >
                    <UserContent text={m.content} />
                  </div>
                </div>
              );
            // AI応答: タップで編集/分岐/巻き戻しの操作列を出す(Zetaのペン編集+範囲削除+並行世界)
            if (editingIdx === m.idx)
              return (
                <div key={m.idx} data-testid="edit-area" className="card p-3">
                  <p className="label">応答を直接直す</p>
                  <textarea
                    className="input h-36 text-sm"
                    style={{ fontFamily: "var(--font-novel)" }}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    <button data-testid="edit-save" className="btn-primary flex-1 py-2 text-sm" onClick={saveEdit}>
                      保存
                    </button>
                    <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => setEditingIdx(null)}>
                      やめる
                    </button>
                  </div>
                </div>
              );
            return (
              <div key={m.idx}>
                <div
                  data-testid="ai-line"
                  className="whitespace-pre-wrap"
                  style={{
                    cursor: rewindMode ? "pointer" : undefined,
                    outline: rewindMode ? "1px dashed var(--c-primary)" : "none",
                    background:
                      rewindMode && rewindIdx === m.idx
                        ? "color-mix(in oklab, var(--c-primary) 14%, transparent)"
                        : undefined,
                    borderRadius: rewindMode ? 8 : undefined,
                  }}
                  onClick={() => {
                    if (rewindMode) setRewindIdx(m.idx);
                    else if (props.mode === "auth" && !generating)
                      setSelectedAiIdx((cur) => (cur === m.idx ? null : m.idx));
                  }}
                >
                  <AiContent text={m.content} />
                </div>
                {selectedAiIdx === m.idx && !rewindMode && !generating && (
                  <div data-testid="ai-action-row" className="modal-pop mt-2 flex flex-wrap gap-2 text-xs">
                    <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => startEdit(m)}>
                      ✎ 直接直す
                    </button>
                    <button
                      data-testid="branch-button"
                      className="btn-ghost px-3 py-1.5 text-xs"
                      onClick={() => branchAt(m.idx)}
                    >
                      🌱 ここから分岐
                    </button>
                    {m.idx !== messages[messages.length - 1].idx && (
                      <button
                        className="btn-ghost px-3 py-1.5 text-xs"
                        onClick={() => {
                          setRewindIdx(m.idx);
                          setRewindMode(true);
                          setSelectedAiIdx(null);
                        }}
                      >
                        ↩ ここまで戻す
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {generating && (
            <div data-testid="generating" className="whitespace-pre-wrap">
              <AiContent text={streamText} />
              <span className="caret">▌</span>
            </div>
          )}

          {blockedMsg && (
            <div data-testid="blocked-card" className="card p-3 text-sm" style={{ borderColor: "var(--c-danger)" }}>
              {blockedMsg}
            </div>
          )}
          {quotaMsg && (
            <div data-testid="quota-card" className="card p-3 text-sm">
              🌙 {quotaMsg}
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
                  もう一度
                </button>
              )}
            </div>
          )}

          {/* 最新応答への操作 */}
          {!generating && !rewindMode && messages && messages.some((m) => m.role === "AI") && props.mode === "auth" && (
            <div className="flex gap-2 text-xs" style={{ color: "var(--c-textMuted)" }}>
              <button
                className="btn-ghost px-3 py-1.5 text-xs"
                onPointerDown={() => (pressStartRef.current = Date.now())}
                onClick={() => {
                  if (Date.now() - pressStartRef.current >= 500) setInstructionOpen(true);
                  else reroll();
                }}
              >
                🔄 書き直す
              </button>
              <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setRewindMode(true)}>
                ↩ 少し戻る
              </button>
            </div>
          )}

          {rewindMode && (
            <div className="card sticky bottom-24 z-10 p-3 text-sm">
              <p className="text-xs">戻りたい場所のメッセージをタップしてください</p>
              <div className="mt-2 flex gap-2">
                <button className="btn-primary flex-1 py-2 text-sm" disabled={rewindIdx === null} onClick={doRewind}>
                  ここまで戻す
                </button>
                <button
                  className="btn-ghost flex-1 py-2 text-sm"
                  onClick={() => {
                    setRewindMode(false);
                    setRewindIdx(null);
                  }}
                >
                  やめる
                </button>
              </div>
            </div>
          )}

          {isLatest && !generating && lastAiWithChoices?.choices && (
            <div data-testid="choice-card" className="fade-in space-y-2">
              <p className="text-xs tracking-wide" style={{ color: "var(--c-textMuted)" }}>
                ── どうする? ──
              </p>
              {lastAiWithChoices.choices.map((c) => (
                <button
                  key={c.id}
                  className="card choice-card block w-full px-4 py-3 text-left text-sm"
                  onClick={() => send(c.text, c.id)}
                >
                  <span className="mr-1.5" style={{ color: "var(--c-primary)" }} aria-hidden>
                    ◆
                  </span>
                  {c.text}
                </button>
              ))}
              <button
                className="text-xs underline"
                style={{ color: "var(--c-textMuted)" }}
                onClick={() => inputRef.current?.focus()}
              >
                自分で書く
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* 追従が切れている時の「↓最新へ」チップ */}
      {showLatestChip && messages && messages.length > 2 && (
        <button
          data-testid="scroll-latest-chip"
          className="chip fade-in fixed bottom-24 left-1/2 z-20 -translate-x-1/2 shadow-md"
          style={{ background: "var(--c-surface)", animationDelay: "0s" }}
          onClick={scrollToLatest}
        >
          ↓ 最新へ
        </button>
      )}

      <footer
        className="sticky bottom-0 z-10 border-t px-3 py-2.5"
        style={{ background: "var(--c-surface)", borderColor: "var(--c-border)" }}
      >
        {/* 入力の *〜* ライブプレビュー(地の文として表示される見え方の確認) */}
        {inputHasNarration && (
          <p data-testid="input-preview" className="novel mb-1.5 truncate px-1 text-xs" style={{ color: "var(--c-textMuted)" }}>
            <UserContent text={input} />
          </p>
        )}
        {/* AIF-008: 返信候補チップ */}
        {suggestLoading && (
          <div className="mb-2 space-y-1.5" aria-label="候補を考え中">
            <div className="skeleton h-8 w-full" />
            <div className="skeleton h-8 w-10/12" />
          </div>
        )}
        {suggestions && (
          <div data-testid="suggest-chips" className="fade-in mb-2 space-y-1.5">
            {suggestions.map((s, i) => (
              <button
                key={i}
                data-testid="suggest-chip"
                className="card block w-full px-3 py-2 text-left text-xs"
                style={{ borderColor: "color-mix(in oklab, var(--c-accent) 40%, var(--c-border))" }}
                onClick={() => {
                  setInput(s);
                  setSuggestions(null);
                  inputRef.current?.focus();
                }}
              >
                <span className="mr-1" style={{ color: "var(--c-accent)" }} aria-hidden>
                  ✦
                </span>
                {s}
              </button>
            ))}
            {suggestRemaining !== null && (
              <p data-testid="suggest-remaining" className="px-1 text-right text-[0.68rem]" style={{ color: "var(--c-textMuted)" }}>
                今日の残り {suggestRemaining} 回
              </p>
            )}
          </div>
        )}
        {suggestNotice && (
          <p data-testid="suggest-notice" className="mb-1.5 px-1 text-xs" style={{ color: "var(--c-textMuted)" }}>
            {suggestNotice}
          </p>
        )}
        <div className="flex items-end gap-2">
          {props.mode === "auth" && (
            <button
              aria-label="返信候補"
              title="返信に迷ったら(AIが候補を書く)"
              className="btn-ghost px-3 py-2.5"
              disabled={generating || !messages || suggestLoading}
              onClick={() => (suggestions ? setSuggestions(null) : fetchSuggestions())}
            >
              {suggestLoading ? <span className="caret">✦</span> : "✦"}
            </button>
          )}
          <textarea
            ref={inputRef}
            rows={1}
            className="input max-h-28 flex-1 resize-none"
            placeholder="セリフか、*動作* を書く…"
            value={input}
            disabled={generating || !messages}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`;
            }}
          />
          {input.trim() ? (
            <button
              aria-label="送信"
              className="btn-primary px-4 py-2.5"
              disabled={generating || !messages}
              onClick={() => send(input)}
            >
              ▶
            </button>
          ) : (
            <button
              className="btn-ghost whitespace-nowrap px-3 py-2.5 text-sm"
              disabled={generating || !messages}
              onClick={() => send("")}
            >
              つづきを読む
            </button>
          )}
        </div>
      </footer>

      {/* 指示付き書き直し */}
      {instructionOpen && (
        <div className="backdrop fixed inset-0 z-30 flex items-center justify-center px-6">
          <div className="card modal-pop w-full max-w-sm p-4">
            <p className="text-sm font-bold">方向を指定して書き直す</p>
            <input
              className="input mt-2"
              placeholder="方向を指定(例: もっと切なく)"
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
                この方向で書き直す
              </button>
              <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => setInstructionOpen(false)}>
                やめる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* メニュー */}
      {menuOpen && (
        <div className="backdrop fixed inset-0 z-30" onClick={() => setMenuOpen(false)}>
          <div
            className="card drawer-in absolute right-0 top-0 h-full w-72 overflow-y-auto rounded-none p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 truncate text-sm font-bold">{title}</p>
            {props.mode === "auth" && (
              <button
                className="block w-full py-2.5 text-left text-sm disabled:opacity-40"
                disabled={!messages}
                onClick={() => {
                  setMenuOpen(false);
                  setMemoryOpen(true);
                }}
              >
                🧠 記憶
              </button>
            )}
            {props.mode === "auth" && (
              <button
                className="block w-full py-2.5 text-left text-sm disabled:opacity-40"
                disabled={!messages}
                onClick={openRoutes}
              >
                🌱 ルート(並行世界)
              </button>
            )}
            <Link href={`/s/${situationId}`} className="block w-full py-2.5 text-left text-sm">
              📖 この作品ページへ
            </Link>
            {props.mode === "auth" && (
              <>
                <div className="my-2 border-t" style={{ borderColor: "var(--c-border)" }} />
                {/* 初期fetch完了前に押すと結果で上書きされるため、ロード中は無効 */}
                <button
                  data-testid="toggle-choices"
                  className="flex w-full items-center justify-between py-2.5 text-left text-sm disabled:opacity-40"
                  disabled={!messages}
                  onClick={() => patchStorySetting({ choicesEnabled: !choicesEnabled })}
                >
                  <span>🔀 選択肢を表示</span>
                  <span className="chip px-2.5 py-0.5 text-[0.7rem]" data-on={choicesEnabled}>
                    {choicesEnabled ? "ON" : "OFF"}
                  </span>
                </button>
                <button
                  data-testid="toggle-midmodel"
                  className="flex w-full items-center justify-between py-2.5 text-left text-sm disabled:opacity-40"
                  disabled={!messages}
                  onClick={() => patchStorySetting({ useMidModel: !useMidModel })}
                >
                  <span>🖋 高品質モデル(β)</span>
                  <span className="chip px-2.5 py-0.5 text-[0.7rem]" data-on={useMidModel}>
                    {useMidModel ? "ON" : "OFF"}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ルート(並行世界)シート */}
      {routesOpen && (
        <div className="backdrop fixed inset-0 z-30" onClick={() => setRoutesOpen(false)}>
          <div
            data-testid="route-sheet"
            className="card sheet-up absolute bottom-0 left-0 right-0 max-h-[70dvh] overflow-y-auto rounded-b-none p-4 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-grabber" aria-hidden />
            <p className="text-sm font-bold">🌱 ルート(並行世界)</p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--c-textMuted)" }}>
              同じ物語を、違う選択で読み直せます
            </p>
            {!routes && (
              <p className="mt-3 text-xs" style={{ color: "var(--c-textMuted)" }}>
                読み込み中…
              </p>
            )}
            <div className="mt-3 space-y-2">
              {routes?.map((rt, i) => (
                <button
                  key={rt.id}
                  data-testid="route-item"
                  className="card block w-full px-3 py-2.5 text-left"
                  style={rt.id === props.storyId ? { borderColor: "var(--c-primary)" } : undefined}
                  onClick={() => {
                    if (rt.id !== props.storyId) {
                      setRoutesOpen(false);
                      router.push(`/story/${rt.id}`);
                    }
                  }}
                >
                  <p className="text-xs font-bold">
                    ルート{routes.length - i}
                    {rt.branchedFromStoryId ? "(分岐)" : ""}
                    {rt.id === props.storyId && (
                      <span className="ml-1.5" style={{ color: "var(--c-primary)" }}>
                        ● いま読んでいる
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs" style={{ color: "var(--c-textMuted)" }}>
                    {rt.messages[0]?.content ?? ""}
                  </p>
                </button>
              ))}
            </div>
            <button
              className="btn-ghost mt-3 w-full py-2.5 text-sm"
              onClick={async () => {
                const detail = await fetch(`/api/situations/${situationId}`).then((r) => r.json());
                const r = await fetch("/api/stories", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ situationId, introVariantId: detail.intros[0].id }),
                });
                if (r.ok) {
                  const st = await r.json();
                  setRoutesOpen(false);
                  router.push(`/story/${st.id}`);
                }
              }}
            >
              ＋ 最初から新しいルートで読む
            </button>
          </div>
        </div>
      )}

      {/* 記憶モーダル */}
      {memoryOpen && (
        <div className="backdrop fixed inset-0 z-30 flex items-center justify-center px-6">
          <div className="card modal-pop w-full max-w-sm p-4">
            <p className="text-sm font-bold">記憶</p>
            {summary && (
              <>
                <p className="label mt-3">これまでのあらすじ(自動)</p>
                <p className="max-h-24 overflow-y-auto text-xs">{summary}</p>
              </>
            )}
            <p className="label mt-3">ユーザーノート</p>
            <textarea
              className="input h-24"
              placeholder="いつも覚えていてほしいことを書く(例: 私は猫アレルギー)"
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
            />
            {savedToast && (
              <p className="mt-1 text-xs" style={{ color: "var(--c-primary)" }}>
                保存しました
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                className="btn-primary flex-1 py-2 text-sm"
                onClick={async () => {
                  const r = await fetch(`/api/stories/${props.storyId}/memory`, {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ userNote }),
                  });
                  if (!r.ok) return; // 失敗時に「保存しました」を出さない
                  setSavedToast(true);
                  setTimeout(() => setSavedToast(false), 2500);
                }}
              >
                保存
              </button>
              <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => setMemoryOpen(false)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ゲスト登録壁 */}
      {guestGate && (
        <div data-testid="guest-gate" className="backdrop fixed inset-0 z-40 flex items-center justify-center px-6">
          <div className="card modal-pop w-full max-w-sm p-5 text-center">
            <p className="text-lg font-bold">ここまでの物語を保存して、続きを読もう</p>
            <p className="mt-2 text-xs" style={{ color: "var(--c-textMuted)" }}>
              登録すると、この物語の続きと本棚が使えるようになります
            </p>
            <Link href={`/login?returnTo=${encodeURIComponent("/story/guest")}`} className="btn-primary mt-4 block">
              登録して続きを読む
            </Link>
            <button className="mt-2 text-xs underline" style={{ color: "var(--c-textMuted)" }} onClick={() => setGuestGate(false)}>
              あとで
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
