"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postSse } from "./sse-client";
import { coverGradient } from "./SituationCard";
import {
  AlignLeft,
  ArrowDown,
  ArrowLeft,
  Asterisk,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Copy,
  FastForward,
  Feather,
  GitBranch,
  Info,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Pencil,
  PenLine,
  Plus,
  RotateCcw,
  Send,
  Shuffle,
  Sparkle,
  Sparkles,
  Trash2,
  Undo2,
  UserRound,
  Zap,
} from "lucide-react";

/** 実機トラブルの一次情報をサーバーログへ(fire-and-forget) */
function reportClientError(type: string, message: string) {
  try {
    fetch("/api/client-log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, message, url: location.pathname }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* noop */
  }
}

export interface ReaderMessage {
  idx: number;
  role: "USER" | "AI" | "SYSTEM";
  content: string;
  kind?: string | null; // SAY / ACTION / DIRECTION
  createdAt?: string | null;
  choices?: { id: string; text: string }[] | null;
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
function fmtTime(d: Date) {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type ComposeMode = "SAY" | "ACTION" | "DIRECTION";

const COMPOSE_MODES: { key: ComposeMode; label: string; Icon: typeof MessageCircle }[] = [
  { key: "SAY", label: "セリフ", Icon: MessageCircle },
  { key: "ACTION", label: "動作", Icon: Asterisk },
  { key: "DIRECTION", label: "展開", Icon: Clapperboard },
];

/** AIモデル(Zetaのモデル選択に相当)。midは高品質モデルのフラグ */
const MODELS = [
  {
    id: "bukucha",
    name: "bukucha",
    mid: false,
    desc: "テンポよく進む、標準のモデル",
    cost: "無料",
  },
  {
    id: "bukucha-pro",
    name: "bukucha pro",
    mid: true,
    desc: "細かな設定も逃さない、高品質モデル",
    cost: "ベータ公開中は無料",
  },
] as const;

const MODE_PLACEHOLDER: Record<ComposeMode, string> = {
  SAY: "セリフか、*動作* を書く…",
  ACTION: "主人公の動作・情景を書く…(地の文になる)",
  DIRECTION: "作者として展開を指示…(例: 雨を降らせて)",
};

// Zetaの「*あらすじ:〜*」裏ワザの製品化: 定番の進行ディレクティブ
const DIRECTION_PRESETS = [
  "時間を少し進めて、次の場面へ",
  "場面を転換して、新しいシーンから",
  "ここで予想外の出来事を起こして",
  "ふたりの距離が縮まる展開にして",
  "クライマックスに向けて盛り上げて",
];

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

interface TalkChar {
  name: string;
  profileImageUrl: string | null;
}

/** 吹き出し内テキスト: 「」セリフは強調、地の文断片は斜体 */
function SpeechText({ text }: { text: string }) {
  const parts = text.split(/(「[^」]*」)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("「")) {
          return (
            <span key={i} className="dialogue block whitespace-pre-wrap">
              {p}
            </span>
          );
        }
        const t = p.replace(/\*/g, "").trim();
        return t ? (
          <em key={i} className="block whitespace-pre-wrap py-0.5 opacity-75">
            {t}
          </em>
        ) : null;
      })}
    </>
  );
}

/**
 * AI応答のトーク描画(Zetaのルーム構造):
 * セリフを含まない段落 = ナレーションブロック(ガター付き地の文)、
 * セリフを含む段落 = 話者アバター+名前+吹き出し
 */
function AiTalk({ text, chars }: { text: string; chars: TalkChar[] }) {
  const paras = text
    .split(/\n+/)
    .map((t) => t.trim())
    .filter(Boolean);
  return (
    <div className="space-y-3">
      {paras.map((para, i) => {
        const speechIdx = para.indexOf("「");
        if (speechIdx === -1 || chars.length === 0) {
          return (
            <div key={i} className="flex gap-2.5">
              <span aria-hidden className="select-none pt-1.5" style={{ color: "var(--c-textMuted)" }}>
                <AlignLeft size={13} />
              </span>
              <p className="min-w-0 flex-1 whitespace-pre-wrap">
                {para.split(/(\*[^*]+\*)/g).map((seg, j) =>
                  seg.startsWith("*") && seg.endsWith("*") ? <em key={j}>{seg.slice(1, -1)}</em> : <span key={j}>{seg}</span>
                )}
              </p>
            </div>
          );
        }
        const before = para.slice(0, speechIdx);
        const firstName = (c: TalkChar) => c.name.split(/[\s　]/)[0];
        const speaker =
          chars.find((c) => before.includes(firstName(c))) ??
          chars.find((c) => para.includes(firstName(c))) ??
          chars[0];
        return (
          <div key={i} className="flex items-start gap-2">
            {speaker.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={speaker.profileImageUrl} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <span
                aria-hidden
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-serif text-xs font-bold text-white"
                style={{ background: coverGradient(speaker.name) }}
              >
                {speaker.name.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 text-[0.7rem]" style={{ color: "var(--c-textMuted)" }}>
                {speaker.name}
              </p>
              <div
                className="inline-block max-w-full rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[0.95rem]"
                style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}
              >
                <SpeechText text={para} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
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
  const [modelOpen, setModelOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [personaOpen, setPersonaOpen] = useState(false);
  const [personas, setPersonas] = useState<{ id: string; name: string; isDefault: boolean }[] | null>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);
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
  const [selectedUserIdx, setSelectedUserIdx] = useState<number | null>(null);
  const [mode, setMode] = useState<ComposeMode>("SAY");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [routesOpen, setRoutesOpen] = useState(false);
  const [routes, setRoutes] = useState<RouteItem[] | null>(null);
  const [chars, setChars] = useState<TalkChar[]>([]);
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
  // ストリーミングの実受信テキスト。表示(streamText)はrAFで等速に追いつく(タイプライタ)
  const streamTargetRef = useRef("");

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
        const r = await fetch(`/api/situations/${g.situationId}`);
        if (r.ok) {
          const d = await r.json();
          setChars(d.characters ?? []);
          if (g.messages.length === 0) {
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
        setPersonaId(st.personaId ?? null);
        setMessages(
          st.messages.map((m: ReaderMessage & { choices: unknown }) => ({
            idx: m.idx,
            role: m.role,
            content: m.content,
            kind: m.kind ?? "SAY",
            createdAt: m.createdAt ?? null,
            choices: (m.choices as { id: string; text: string }[] | null) ?? null,
          }))
        );
        setChars(st.situation.characters ?? []);
        setSummary(st.memory?.summary ?? "");
        setUserNote(st.memory?.userNote ?? "");
      }
      // ゲスト→登録引き継ぎ後の入力復元(E2E-002)。無ければ下書きを復元
      const pending = localStorage.getItem("bukucha_guest_pending");
      if (pending) {
        setInput(pending);
        localStorage.removeItem("bukucha_guest_pending");
      } else {
        try {
          const d = localStorage.getItem(`bukucha_draft_${props.storyId ?? "guest"}`);
          if (d) {
            const parsed = JSON.parse(d);
            if (parsed.input) {
              setInput(parsed.input);
              if (parsed.mode) setMode(parsed.mode);
            }
          }
        } catch {
          /* noop */
        }
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

  // エラー・ブロックのカードは追従状態に関係なく必ず視界に入れる
  useEffect(() => {
    if (errorMsg || blockedMsg || quotaMsg) {
      programmaticScrollRef.current = true;
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [errorMsg, blockedMsg, quotaMsg]);

  // 下書き自動保存: 離脱してもリロードしても入力が消えない
  useEffect(() => {
    if (!messages) return; // ロード完了前は保存済み下書きを消さない
    const key = `bukucha_draft_${props.storyId ?? "guest"}`;
    try {
      if (input.trim()) localStorage.setItem(key, JSON.stringify({ input, mode }));
      else localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  }, [input, mode, messages, props.storyId]);

  // チャンクが塊で届いても文字が等速で流れ込むように、表示をrAFで追いつかせる
  // [USER-REQ: 文章が連続的に出てくる体験]
  useEffect(() => {
    if (!generating) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const tick = () => {
      setStreamText((cur) => {
        const target = streamTargetRef.current;
        if (cur.length >= target.length) return cur;
        if (reduce) return target;
        const step = Math.max(1, Math.ceil((target.length - cur.length) / 14));
        return target.slice(0, cur.length + step);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [generating]);

  const guestUserCount = messages?.filter((m) => m.role === "USER").length ?? 0;

  const send = useCallback(
    async (content: string, selectedChoiceId?: string, kindOverride?: ComposeMode) => {
      if (generating || !messages) return;
      const kind: ComposeMode =
        props.mode === "guest" ? "SAY" : selectedChoiceId ? "SAY" : (kindOverride ?? mode);
      setBlockedMsg(null);
      setQuotaMsg(null);
      setErrorMsg(null);
      setSuggestions(null);
      setSuggestNotice(null);
      setSelectedAiIdx(null);
      setSelectedUserIdx(null);
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
          { idx: maxIdx + 1, role: "USER", content, kind, createdAt: new Date().toISOString() },
        ]);
      }
      setInput("");
      // 展開指示は一回性の操作なので、送ったらセリフモードに戻す
      if (kind === "DIRECTION") setMode("SAY");
      setGenerating(true);
      streamTargetRef.current = "";
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
            onToken: (t) => void (streamTargetRef.current += t),
            onBlocked: (msg) => {
              setBlockedMsg(msg);
              restore();
            },
            onError: (code, msg) => {
              reportClientError("guest_send_error", `${code}: ${msg}`);
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
          { content, selectedChoiceId, kind },
          {
            onToken: (t) => void (streamTargetRef.current += t),
            onBlocked: (msg) => {
              setBlockedMsg(msg);
              restore();
            },
            onError: (code, msg) => {
              if (code === "quota_exceeded") {
                setQuotaMsg(msg);
                restore();
              } else {
                reportClientError("send_error", `${code}: ${msg}`);
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
                  createdAt: new Date().toISOString(),
                  choices: d.message!.choices,
                },
              ]);
            },
          }
        );
      }
      streamTargetRef.current = "";
      setStreamText("");
      setGenerating(false);
    },
    [generating, messages, props.mode, props.storyId, guestUserCount, mode]
  );

  // ✍ 打ち直す: 自分の発言を取り消して入力欄に復元(Zetaは削除→手で再入力が必要な部分の解消)
  const retypeMessage = async (m: ReaderMessage) => {
    if (!messages || generating) return;
    const i = messages.findIndex((x) => x.idx === m.idx);
    if (i <= 0) return;
    const prevIdx = messages[i - 1].idx;
    const r = await fetch(`/api/stories/${props.storyId}/rewind`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toIdx: prevIdx }),
    });
    if (r.ok) {
      setMessages((prev) => prev!.filter((x) => x.idx <= prevIdx));
      setInput(m.content);
      setMode((m.kind as ComposeMode) || "SAY");
      setSelectedUserIdx(null);
      inputRef.current?.focus();
    }
  };

  const reroll = useCallback(
    async (withInstruction?: string) => {
      if (generating || !messages || props.mode === "guest") return;
      const lastAi = [...messages].reverse().find((m) => m.role === "AI");
      if (!lastAi) return;
      setGenerating(true);
      streamTargetRef.current = "";
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
          onToken: (t) => void (streamTargetRef.current += t),
          onBlocked: (msg) => {
            setBlockedMsg(msg);
            setMessages((prev) => [...prev!, lastAi].sort((a, b) => a.idx - b.idx));
          },
          onError: (_c, msg) => {
            reportClientError("reroll_error", msg);
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
      streamTargetRef.current = "";
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

  /** 同じ作品で新しいトークを始める(いまのトークは本棚に残る) */
  const startNewTalk = async () => {
    const detail = await fetch(`/api/situations/${situationId}`).then((r) => r.json());
    const r = await fetch("/api/stories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ situationId, introVariantId: detail.intros[0].id }),
    });
    if (!r.ok) return;
    const st = await r.json();
    setMenuOpen(false);
    router.push(`/story/${st.id}`);
  };

  const deleteTalk = async () => {
    if (!confirm("このトークを削除しますか?(元に戻せません)")) return;
    await fetch(`/api/stories/${props.storyId}`, { method: "DELETE" });
    router.push("/bookshelf");
  };

  const openPersonas = async () => {
    setPersonaOpen(true);
    if (personas) return;
    const r = await fetch("/api/me/personas");
    if (r.ok) setPersonas(await r.json());
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
          className="shrink-0"
          onClick={() => router.push(props.mode === "guest" ? `/s/${situationId}` : "/bookshelf")}
        >
          <ArrowLeft size={20} strokeWidth={1.9} />
        </button>
        <p className="ml-2 flex-1 truncate text-[0.95rem] font-bold">{title}</p>
        {props.mode === "auth" && (
          <button
            data-testid="model-chip"
            className="chip mr-1 shrink-0 px-2.5 py-1 text-[0.72rem]"
            onClick={() => setModelOpen(true)}
          >
            {MODELS.find((m) => m.mid === useMidModel)?.name}
            <ChevronDown size={12} className="ml-0.5 inline align-[-2px]" />
          </button>
        )}
        <button
          aria-label="メニュー"
          className="shrink-0"
          onClick={() => {
            setMenuOpen(true);
            if (!personas && props.mode === "auth")
              fetch("/api/me/personas")
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => d && setPersonas(d))
                .catch(() => {});
          }}
        >
          <Menu size={20} />
        </button>
      </header>

      <main className="flex-1 px-5 py-4">
        <div data-testid="novel-stream" className="novel space-y-4">
          {messages && (
            <p className="pb-1 text-center text-[0.68rem]" style={{ color: "var(--c-textMuted)" }}>
              <Info size={11} className="mr-1 inline align-[-1.5px]" /> 物語の返答は全てAIが生成した内容です
            </p>
          )}
          {!messages && (
            <div className="space-y-3 pt-2" aria-label="読み込み中">
              <div className="skeleton mx-auto h-3 w-24" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-11/12" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          )}
          {messages?.map((m, mi) => {
            const prev = mi > 0 ? messages[mi - 1] : null;
            const daySep =
              m.createdAt && prev?.createdAt &&
              new Date(m.createdAt).toDateString() !== new Date(prev.createdAt).toDateString() ? (
                <p
                  data-testid="date-separator"
                  className="pt-2 text-center text-xs tracking-widest"
                  style={{ color: "var(--c-textMuted)" }}
                >
                  ── {fmtDate(new Date(m.createdAt))} ──
                </p>
              ) : null;
            if (m.role === "SYSTEM")
              return (
                <div key={m.idx} className="fade-in whitespace-pre-wrap opacity-90" data-testid="intro-line">
                  <p className="mb-2 text-center text-xs tracking-widest" style={{ color: "var(--c-textMuted)" }}>
                    ── 導入 ──
                  </p>
                  {m.content}
                </div>
              );
            if (m.role === "USER") {
              const onUserTap = () => {
                if (rewindMode) setRewindIdx(m.idx);
                else if (props.mode === "auth" && !generating) {
                  setSelectedAiIdx(null);
                  setSelectedUserIdx((cur) => (cur === m.idx ? null : m.idx));
                }
              };
              const sendStatus = generating && mi === messages.length - 1 && (
                <p
                  data-testid="send-status"
                  className="mt-0.5 text-right text-[0.65rem]"
                  style={{ color: "var(--c-textMuted)" }}
                >
                  ✓ 送信済み
                </p>
              );
              const userActions = selectedUserIdx === m.idx && !rewindMode && !generating && (
                <div data-testid="user-action-row" className="modal-pop mt-1.5 flex items-center justify-end gap-2 text-xs">
                  {m.createdAt && (
                    <span className="text-[0.7rem]" style={{ color: "var(--c-textMuted)" }}>
                      {fmtTime(new Date(m.createdAt))}
                    </span>
                  )}
                  <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => retypeMessage(m)}>
                    <Pencil size={12} className="mr-1 inline align-[-1px]" /> 打ち直す
                  </button>
                  <button
                    className="btn-ghost px-3 py-1.5 text-xs"
                    onClick={() => {
                      navigator.clipboard?.writeText(m.content).catch(() => {});
                      setSelectedUserIdx(null);
                    }}
                  >
                    <Copy size={12} className="mr-1 inline align-[-1px]" /> コピー
                  </button>
                </div>
              );
              // 🎬 展開指示: 主人公の発言ではないので、バブルではなく中央の演出行として描画
              if (m.kind === "DIRECTION")
                return (
                  <div key={m.idx}>
                    {daySep}
                    <p
                      data-testid="direction-line"
                      onClick={onUserTap}
                      className="text-center text-xs tracking-wide"
                      style={{
                        color: "var(--c-textMuted)",
                        cursor: rewindMode || props.mode === "auth" ? "pointer" : "default",
                        outline: rewindMode && rewindIdx === m.idx ? "1px dashed var(--c-primary)" : "none",
                        borderRadius: 8,
                      }}
                    >
                      ── <Clapperboard size={11} className="inline align-[-1px]" /> {m.content} ──
                    </p>
                    {sendStatus}
                    {userActions}
                  </div>
                );
              return (
                <div key={m.idx}>
                  {daySep}
                  <div className="flex justify-end">
                    <div
                      data-testid="user-line"
                      onClick={onUserTap}
                      className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm px-3.5 py-2 text-[0.92rem]"
                      style={{
                        background: rewindMode && rewindIdx === m.idx ? "var(--c-primary)" : "var(--c-userBubble)",
                        color: rewindMode && rewindIdx === m.idx ? "#fff" : "var(--c-novelText)",
                        cursor: rewindMode || props.mode === "auth" ? "pointer" : "default",
                        outline: rewindMode ? "1px dashed var(--c-primary)" : "none",
                      }}
                    >
                      {m.kind === "ACTION" ? <em>{m.content}</em> : <UserContent text={m.content} />}
                    </div>
                  </div>
                  {sendStatus}
                  {userActions}
                </div>
              );
            }
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
                {daySep}
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
                    else if (props.mode === "auth" && !generating) {
                      setSelectedUserIdx(null);
                      setSelectedAiIdx((cur) => (cur === m.idx ? null : m.idx));
                    }
                  }}
                >
                  <AiTalk text={m.content} chars={chars} />
                </div>
                {selectedAiIdx === m.idx && !rewindMode && !generating && (
                  <div data-testid="ai-action-row" className="modal-pop mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {m.createdAt && (
                      <span className="text-[0.7rem]" style={{ color: "var(--c-textMuted)" }}>
                        {fmtTime(new Date(m.createdAt))}
                      </span>
                    )}
                    <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => startEdit(m)}>
                      <PenLine size={12} className="mr-1 inline align-[-1px]" /> 直接直す
                    </button>
                    <button
                      className="btn-ghost px-3 py-1.5 text-xs"
                      onClick={() => {
                        navigator.clipboard?.writeText(m.content).catch(() => {});
                        setSelectedAiIdx(null);
                      }}
                    >
                      <Copy size={12} className="mr-1 inline align-[-1px]" /> コピー
                    </button>
                    <button
                      data-testid="branch-button"
                      className="btn-ghost px-3 py-1.5 text-xs"
                      onClick={() => branchAt(m.idx)}
                    >
                      <GitBranch size={12} className="mr-1 inline align-[-1px]" /> ここから分岐
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
                        <Undo2 size={12} className="mr-1 inline align-[-1px]" /> ここまで戻す
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {generating && (
            <div data-testid="generating" className="whitespace-pre-wrap">
              {streamText ? (
                <>
                  <AiTalk text={streamText} chars={chars} />
                  <span className="caret">▌</span>
                </>
              ) : (
                <span className="typing-dots" aria-label="執筆中">
                  <span>●</span>
                  <span>●</span>
                  <span>●</span>
                </span>
              )}
            </div>
          )}

          {blockedMsg && (
            <div data-testid="blocked-card" className="card p-3 text-sm" style={{ borderColor: "var(--c-danger)" }}>
              {blockedMsg}
            </div>
          )}
          {quotaMsg && (
            <div data-testid="quota-card" className="card p-3 text-sm">
              <Moon size={13} className="mr-1 inline align-[-2px]" /> {quotaMsg}
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
          <ArrowDown size={12} className="mr-0.5 inline align-[-1px]" /> 最新へ
        </button>
      )}

      <footer
        className="sticky bottom-0 z-10 border-t px-3 pt-2.5"
        style={{
          background: "var(--c-surface)",
          borderColor: "var(--c-border)",
          paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))",
        }}
      >
        {/* 送信モード(✱から開く): セリフ / 動作(地の文) / 展開(作者指示) */}
        {props.mode === "auth" && modeOpen && (
          <div data-testid="compose-modes" className="modal-pop mb-2 flex gap-1.5">
            {COMPOSE_MODES.map((m) => (
              <button
                key={m.key}
                data-testid={`mode-${m.key.toLowerCase()}`}
                className="chip px-3 py-1.5 text-[0.72rem]"
                data-on={mode === m.key}
                disabled={generating || !messages}
                onClick={() => {
                  setMode(m.key);
                  setModeOpen(false);
                  inputRef.current?.focus();
                }}
              >
                <m.Icon size={12} className="mr-1 inline align-[-1px]" />
                {m.label}
              </button>
            ))}
          </div>
        )}
        {/* 🎬 展開モード: 定番ディレクティブをワンタップで送れる */}
        {props.mode === "auth" && mode === "DIRECTION" && !generating && (
          <div data-testid="direction-presets" className="hide-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
            {DIRECTION_PRESETS.map((p) => (
              <button
                key={p}
                data-testid="direction-preset"
                className="chip whitespace-nowrap px-3 py-1.5 text-xs"
                disabled={!messages}
                onClick={() => send(p, undefined, "DIRECTION")}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {/* 入力の *〜* / 動作モードのライブプレビュー(地の文として表示される見え方の確認) */}
        {(inputHasNarration || (mode === "ACTION" && input.trim())) && (
          <p data-testid="input-preview" className="novel mb-1.5 truncate px-1 text-xs" style={{ color: "var(--c-textMuted)" }}>
            {mode === "ACTION" ? <em>{input}</em> : <UserContent text={input} />}
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
                <Sparkle size={12} className="mr-1 inline align-[-1px]" style={{ color: "var(--c-accent)" }} aria-hidden />
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
        {/* 操作ツールバー(Zeta型: 左にあらすじ、右に丸アイコン) */}
        {props.mode === "auth" && !rewindMode && messages && messages.some((m) => m.role === "AI") && (
          <div data-testid="reader-toolbar" className="mb-2 flex items-center gap-2">
            <button
              className="chip flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem]"
              onClick={() => setMemoryOpen(true)}
            >
              <Brain size={13} />
              あらすじ
              <span style={{ color: "var(--c-textMuted)" }}>
                第{Math.max(1, Math.floor((messages[messages.length - 1]?.idx ?? 0) / 2))}話
              </span>
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                className="icon-btn h-9 w-9"
                aria-label="応答を編集"
                title="最後の応答を直接直す"
                disabled={generating}
                onClick={() => {
                  const lastAi = [...messages].reverse().find((m) => m.role === "AI");
                  if (lastAi) startEdit(lastAi);
                }}
              >
                <PenLine size={15} />
              </button>
              <button
                className="icon-btn h-9 w-9"
                aria-label="方向を指定"
                title="方向を指示して書き直す"
                disabled={generating}
                onClick={() => setInstructionOpen(true)}
              >
                <Sparkles size={15} />
              </button>
              <button
                className="icon-btn h-9 w-9"
                aria-label="書き直す"
                title="書き直す(長押しで方向指定)"
                disabled={generating}
                onPointerDown={() => (pressStartRef.current = Date.now())}
                onClick={() => {
                  if (Date.now() - pressStartRef.current >= 500) setInstructionOpen(true);
                  else reroll();
                }}
              >
                <RotateCcw size={15} />
              </button>
              <button
                className="icon-btn h-9 w-9"
                aria-label="少し戻る"
                title="巻き戻す"
                disabled={generating}
                onClick={() => setRewindMode(true)}
              >
                <Undo2 size={15} />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          {props.mode === "auth" && (
            <button
              aria-label="返信候補"
              title="返信に迷ったら(AIが候補を書く)"
              className="icon-btn h-11 w-11 shrink-0 border-0"
              style={{ background: "transparent", color: "var(--c-primary)" }}
              disabled={generating || !messages || suggestLoading}
              onClick={() => (suggestions ? setSuggestions(null) : fetchSuggestions())}
            >
              {suggestLoading ? <span className="caret"><Zap size={19} /></span> : <Zap size={19} />}
            </button>
          )}
          <div
            className="flex flex-1 items-end gap-1 rounded-[22px] border px-3 py-1"
            style={{
              borderColor: modeOpen || mode !== "SAY" ? "var(--c-primary)" : "var(--c-border)",
              background: "var(--c-bg)",
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              className="max-h-28 flex-1 resize-none bg-transparent py-2 text-[0.95rem] outline-none"
              placeholder={props.mode === "auth" ? MODE_PLACEHOLDER[mode] : MODE_PLACEHOLDER.SAY}
              value={input}
              disabled={generating || !messages}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  if (input.trim()) send(input);
                }
              }}
            />
            {props.mode === "auth" && (
              <button
                data-testid="mode-toggle"
                aria-label="書き方を選ぶ"
                title="セリフ / 動作 / 展開を選ぶ"
                className="mb-1.5 shrink-0 p-1"
                style={{ color: mode === "SAY" ? "var(--c-textMuted)" : "var(--c-primary)" }}
                disabled={generating || !messages}
                onClick={() => setModeOpen((o) => !o)}
              >
                <Asterisk size={18} />
              </button>
            )}
          </div>
          <button
            aria-label={input.trim() ? "送信" : "つづきを読む"}
            title={input.trim() ? "送信" : "空欄のまま送ると物語が進みます"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
            style={{
              background:
                "linear-gradient(140deg, var(--c-primary), color-mix(in oklab, var(--c-accent) 55%, var(--c-primary)))",
              boxShadow: "0 6px 16px -8px color-mix(in oklab, var(--c-primary) 90%, transparent)",
              opacity: generating || !messages ? 0.4 : 1,
            }}
            disabled={generating || !messages}
            onClick={() => send(input.trim() ? input : "")}
          >
            {input.trim() ? <Send size={17} /> : <FastForward size={17} />}
          </button>
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
            data-testid="reader-menu"
            className="card drawer-in absolute right-0 top-0 flex h-full w-[78%] max-w-[320px] flex-col overflow-y-auto rounded-none p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ピース残高(課金基盤は準備中) */}
            <div
              className="mb-4 flex items-center gap-2 rounded-[12px] px-3 py-2.5"
              style={{ background: "var(--c-surfaceAlt)" }}
            >
              <Sparkle size={15} style={{ color: "var(--c-accent)" }} />
              <span className="text-sm font-bold">0</span>
              <span className="ml-auto text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                ピース(準備中)
              </span>
            </div>

            {props.mode === "auth" && (
              <>
                <button
                  className="w-full py-2.5 text-left disabled:opacity-40"
                  disabled={!messages}
                  onClick={startNewTalk}
                >
                  <span className="block text-sm font-semibold">新しいトーク</span>
                  <span className="block text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                    いまの内容を残したまま、最初から始めます
                  </span>
                </button>
                <button
                  className="flex w-full items-center py-2.5 text-left text-sm disabled:opacity-40"
                  disabled={!messages}
                  onClick={openRoutes}
                >
                  <GitBranch size={15} className="mr-2" /> 再開(ルート)
                  <ChevronRight size={15} className="ml-auto" style={{ color: "var(--c-textMuted)" }} />
                </button>
                <button
                  className="flex w-full items-center py-2.5 text-left text-sm disabled:opacity-40"
                  disabled={!messages}
                  onClick={deleteTalk}
                >
                  <Trash2 size={15} className="mr-2" /> トーク削除
                </button>

                <div className="my-2 border-t" style={{ borderColor: "var(--c-border)" }} />

                <button
                  data-testid="menu-persona"
                  className="flex w-full items-center py-2.5 text-left text-sm disabled:opacity-40"
                  disabled={!messages}
                  onClick={openPersonas}
                >
                  <UserRound size={15} className="mr-2" /> トークプロフィール
                  <span className="ml-auto flex items-center text-xs" style={{ color: "var(--c-textMuted)" }}>
                    {personas?.find((p) => p.id === personaId)?.name ?? "未設定"}
                    <ChevronRight size={15} className="ml-0.5" />
                  </span>
                </button>
                {/* 初期fetch完了前に押すと結果で上書きされるため、ロード中は無効 */}
                <button
                  data-testid="toggle-choices"
                  className="flex w-full items-center py-2.5 text-left text-sm disabled:opacity-40"
                  disabled={!messages}
                  onClick={() => patchStorySetting({ choicesEnabled: !choicesEnabled })}
                >
                  <Shuffle size={15} className="mr-2" /> 選択肢
                  <span className="ml-auto text-xs" style={{ color: "var(--c-textMuted)" }}>
                    {choicesEnabled ? "使用する" : "使用しない"}
                  </span>
                </button>
                <button
                  data-testid="menu-model"
                  className="flex w-full items-center py-2.5 text-left text-sm disabled:opacity-40"
                  disabled={!messages}
                  onClick={() => {
                    setMenuOpen(false);
                    setModelOpen(true);
                  }}
                >
                  <Feather size={15} className="mr-2" /> AIモデル
                  <span className="ml-auto flex items-center text-xs" style={{ color: "var(--c-textMuted)" }}>
                    {MODELS.find((m) => m.mid === useMidModel)?.name}
                    <ChevronRight size={15} className="ml-0.5" />
                  </span>
                </button>
                <button
                  className="flex w-full items-center py-2.5 text-left text-sm disabled:opacity-40"
                  disabled={!messages}
                  onClick={() => {
                    setMenuOpen(false);
                    setMemoryOpen(true);
                  }}
                >
                  <Brain size={15} className="mr-2" /> 記憶
                </button>

                <div className="my-2 border-t" style={{ borderColor: "var(--c-border)" }} />
              </>
            )}

            <Link href={`/s/${situationId}`} className="flex w-full items-center py-2.5 text-left text-sm">
              <BookOpen size={15} className="mr-2" /> この作品ページへ
            </Link>
            <button
              className="mt-auto flex w-full items-center py-3 text-left text-sm"
              style={{ color: "var(--c-textMuted)" }}
              onClick={() => router.push(props.mode === "guest" ? `/s/${situationId}` : "/bookshelf")}
            >
              <LogOut size={15} className="mr-2" /> トークルームを退出
            </button>
          </div>
        </div>
      )}

      {/* AIモデル選択シート */}
      {modelOpen && (
        <div className="backdrop fixed inset-0 z-30" onClick={() => setModelOpen(false)}>
          <div
            data-testid="model-sheet"
            className="card sheet-up absolute bottom-0 left-0 right-0 mx-auto max-h-[80dvh] max-w-[var(--shell-max)] overflow-y-auto rounded-b-none p-5 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-grabber" aria-hidden />
            <p className="text-lg font-bold">AIモデルを選択</p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--c-textMuted)" }}>
              モデルによって文章の密度と、覚えていられる長さが変わります。物語の途中でも切り替えられます。
            </p>
            <p className="mt-2 text-xs" style={{ color: "var(--c-textMuted)" }}>
              0ピース保有中 ・ <span style={{ color: "var(--c-primary)" }}>チャージ(準備中)</span>
            </p>
            <div className="mt-4 space-y-2.5">
              {MODELS.map((m) => {
                const on = m.mid === useMidModel;
                return (
                  <button
                    key={m.id}
                    data-testid={`model-${m.id}`}
                    data-on={on}
                    className="block w-full rounded-[14px] border p-4 text-left"
                    style={{
                      borderColor: on ? "var(--c-primary)" : "var(--c-border)",
                      background: on ? "var(--c-primarySoft)" : "var(--c-surface)",
                    }}
                    onClick={() => {
                      patchStorySetting({ useMidModel: m.mid });
                      setModelOpen(false);
                    }}
                  >
                    <span className="flex items-center">
                      <span className="text-base font-bold tracking-tight">{m.name}</span>
                      {on && <Check size={18} className="ml-auto" style={{ color: "var(--c-primary)" }} />}
                    </span>
                    <span className="mt-1.5 block text-[13px]">{m.desc}</span>
                    <span className="mt-1 flex items-center gap-1 text-xs" style={{ color: "var(--c-accent)" }}>
                      <Sparkle size={12} />
                      {m.cost}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* トークプロフィール(ペルソナ)選択シート */}
      {personaOpen && (
        <div className="backdrop fixed inset-0 z-30" onClick={() => setPersonaOpen(false)}>
          <div
            data-testid="persona-sheet"
            className="card sheet-up absolute bottom-0 left-0 right-0 mx-auto max-h-[70dvh] max-w-[var(--shell-max)] overflow-y-auto rounded-b-none p-5 pt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-grabber" aria-hidden />
            <p className="text-base font-bold">トークプロフィール</p>
            <p className="mt-1 text-xs" style={{ color: "var(--c-textMuted)" }}>
              この物語でのあなたの設定です。キャラクターはこの名前であなたを呼びます。
            </p>
            <div className="mt-3 space-y-2">
              {personas?.map((p) => (
                <button
                  key={p.id}
                  data-testid="persona-option"
                  className="card block w-full px-3 py-2.5 text-left text-sm"
                  style={p.id === personaId ? { borderColor: "var(--c-primary)" } : undefined}
                  onClick={async () => {
                    setPersonaId(p.id);
                    setPersonaOpen(false);
                    await fetch(`/api/stories/${props.storyId}`, {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ personaId: p.id }),
                    });
                  }}
                >
                  {p.name}
                  {p.id === personaId && (
                    <Check size={15} className="ml-2 inline align-[-3px]" style={{ color: "var(--c-primary)" }} />
                  )}
                </button>
              ))}
              {personas?.length === 0 && (
                <p className="text-xs" style={{ color: "var(--c-textMuted)" }}>
                  まだトークプロフィールがありません
                </p>
              )}
            </div>
            <Link href="/me/edit" className="btn-ghost mt-3 block w-full py-2.5 text-center text-sm">
              トークプロフィールを編集
            </Link>
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
            <p className="text-sm font-bold"><GitBranch size={14} className="mr-1 inline align-[-2px]" /> ルート(並行世界)</p>
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
              <Plus size={14} className="mr-1 inline align-[-2px]" /> 最初から新しいルートで読む
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
