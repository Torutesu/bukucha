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
  storyId: string;
  introId: string;
  title: string;
  introText: string;
  messages: { role: "USER" | "AI"; content: string }[];
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

// SCR-006: ノベルリーダー本体
export function Reader(props: {
  mode: "auth" | "guest";
  routeId?: string;
  storyId?: string;
  storyTitle?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(props.storyTitle ?? "");
  const [storyId, setStoryId] = useState(props.storyId ?? "");
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
  const guestRef = useRef<GuestStory | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pressStartRef = useRef(0);
  const rerollingRef = useRef(false);

  // 初期ロード
  useEffect(() => {
    (async () => {
      if (props.mode === "guest") {
        const raw = localStorage.getItem("hc_guest_route");
        if (!raw) {
          router.replace("/");
          return;
        }
        const g: GuestStory = JSON.parse(raw);
        guestRef.current = g;
        setTitle(g.title);
        setStoryId(g.storyId);
        const base: ReaderMessage[] = [{ idx: 0, role: "SYSTEM", content: g.introText }];
        if (g.messages.length === 0) {
          // 初回: firstMessageを取得するために1回generate…ではなく詳細から取得
          const r = await fetch(`/api/stories/${g.storyId}`);
          if (r.ok) {
            const d = await r.json();
            const intro = d.intros.find((i: { id: string }) => i.id === g.introId);
            if (intro) {
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
          setErrorMsg("物語を読み込めませんでした");
          setMessages([]);
          return;
        }
        const st = await r.json();
        setTitle(st.story.title);
        setStoryId(st.story.id);
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
  }, [props.mode, props.routeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streamText]);

  const guestUserCount = messages?.filter((m) => m.role === "USER").length ?? 0;

  const send = useCallback(
    async (content: string, selectedChoiceId?: string) => {
      if (generating || !messages) return;
      setBlockedMsg(null);
      setQuotaMsg(null);
      setErrorMsg(null);

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
            storyId: g.storyId,
            introId: g.introId,
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
    [generating, messages, props.mode, props.routeId, guestUserCount]
  );

  const reroll = useCallback(
    async (withInstruction?: string) => {
      if (generating || !messages || props.mode === "guest") return;
      const lastAi = [...messages].reverse().find((m) => m.role === "AI");
      if (!lastAi) return;
      setGenerating(true);
      setStreamText("");
      rerollingRef.current = true;
      // 対象を一旦本文から外す
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
      inputRef.current?.focus();
    }
  };

  const lastAiWithChoices = messages
    ? [...messages].reverse().find((m) => m.role === "AI" && m.choices && m.choices.length)
    : undefined;
  const isLatest = lastAiWithChoices && messages && lastAiWithChoices.idx === messages[messages.length - 1].idx;

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: "var(--c-novelBg)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-2.5"
        style={{ background: "color-mix(in oklab, var(--c-novelBg) 92%, transparent)", borderColor: "var(--c-border)", backdropFilter: "blur(6px)" }}
      >
        <button
          aria-label="戻る"
          className="text-lg"
          onClick={() => router.push(props.mode === "guest" ? `/story/${storyId}` : "/library")}
        >
          ←
        </button>
        <p className="mx-2 flex-1 truncate text-center text-xs" style={{ color: "var(--c-textMuted)" }}>
          {title}
        </p>
        <button aria-label="メニュー" className="text-lg" onClick={() => setMenuOpen(true)}>
          ⋯
        </button>
      </header>

      <main className="flex-1 px-5 py-4">
        <div data-testid="novel-stream" className="novel space-y-4">
          {!messages && <p style={{ color: "var(--c-textMuted)" }}>読み込み中…</p>}
          {messages?.map((m) => {
            if (m.role === "SYSTEM")
              return (
                <div key={m.idx} className="whitespace-pre-wrap opacity-90" data-testid="intro-line">
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
            return (
              <div key={m.idx} data-testid="ai-line" className="whitespace-pre-wrap">
                {m.content}
              </div>
            );
          })}

          {generating && (
            <div data-testid="generating" className="whitespace-pre-wrap">
              {streamText}
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
                自分で書く
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
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
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6">
          <div className="card w-full max-w-sm p-4">
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
        <div className="fixed inset-0 z-30 bg-black/50" onClick={() => setMenuOpen(false)}>
          <div
            className="card absolute right-0 top-0 h-full w-64 rounded-none p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 truncate text-sm font-bold">{title}</p>
            {props.mode === "auth" && (
              <button
                className="block w-full py-2.5 text-left text-sm"
                onClick={() => {
                  setMenuOpen(false);
                  setMemoryOpen(true);
                }}
              >
                🧠 記憶
              </button>
            )}
            <Link href={`/story/${storyId}`} className="block w-full py-2.5 text-left text-sm">
              📖 この作品ページへ
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
                  if (r.ok) {
                    const st = await r.json();
                    router.push(`/play/${st.id}`);
                  }
                }}
              >
                🌱 最初から新しいルートで読む
              </button>
            )}
          </div>
        </div>
      )}

      {/* 記憶モーダル */}
      {memoryOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6">
          <div className="card w-full max-w-sm p-4">
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
                  await fetch(`/api/routes/${props.routeId}/memory`, {
                    method: "PUT",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ userNote }),
                  });
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
        <div data-testid="guest-gate" className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-6">
          <div className="card w-full max-w-sm p-5 text-center">
            <p className="text-lg font-bold">ここまでの物語を保存して、続きを読もう</p>
            <p className="mt-2 text-xs" style={{ color: "var(--c-textMuted)" }}>
              登録すると、この物語の続きと本棚が使えるようになります
            </p>
            <Link href={`/login?returnTo=${encodeURIComponent("/play/guest")}`} className="btn-primary mt-4 block">
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
