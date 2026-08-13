"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { coverGradient, SituationCard, type CardData } from "@/components/SituationCard";
import { fmtCount, fmtDateJa } from "@/lib/format";
import { ArrowLeft, BookOpen, Ellipsis, Heart, MessageCircle } from "lucide-react";

interface Detail {
  id: string;
  title: string;
  catchphrase: string;
  worldSetting: string;
  coverImageUrl: string | null;
  contentLevel: "ALL_AGES" | "R15" | "R18";
  likeCount: number;
  readerCount: number;
  storyCount: number;
  publishedAt: string | null;
  likedByMe: boolean;
  author: { id: string; nickname: string };
  characters: {
    id: string;
    name: string;
    profileImageUrl: string | null;
    personality: string;
    speechStyle: string;
    relationship: string;
  }[];
  intros: { id: string; label: string; introText: string; firstMessage: string }[];
  tags: { tag: { id: string; name: string } }[];
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[0.8rem] font-bold tracking-widest" style={{ color: "var(--c-textMuted)" }}>
      <span aria-hidden className="h-3.5 w-1 rounded-full" style={{ background: "var(--c-primary)" }} />
      {children}
    </h2>
  );
}

// SCR-005: 作品詳細(Zeta型プロフィールページ)
export default function SituationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [introId, setIntroId] = useState<string>("");
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [continueStory, setContinueStory] = useState<{ id: string; count: number } | null>(null);
  const [starting, setStarting] = useState(false);
  const [charModal, setCharModal] = useState<Detail["characters"][0] | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const [worldExpanded, setWorldExpanded] = useState(false);
  const [related, setRelated] = useState<CardData[] | null>(null);

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/me");
      const meData = meRes.ok ? await meRes.json() : null;
      setMe(meData);
      const r = await fetch(`/api/situations/${id}`);
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        setErrorMsg(j?.error?.message ?? "この物語は表示できません");
        return;
      }
      const d: Detail = await r.json();
      setDetail(d);
      const firstTag = d.tags[0]?.tag.name;
      if (firstTag) {
        fetch(`/api/search?tags=${encodeURIComponent(firstTag)}&sort=popular`)
          .then((res) => (res.ok ? res.json() : null))
          .then((j) => {
            if (j) setRelated((j.items as CardData[]).filter((x) => x.id !== id).slice(0, 6));
          })
          .catch(() => {});
      }
      setIntroId(d.intros[0]?.id ?? "");
      setLikeCount(d.likeCount);
      setLiked(d.likedByMe);
      if (meData) {
        const st = await fetch(`/api/stories?situationId=${id}`);
        if (st.ok) {
          const j = await st.json();
          if (j.items.length > 0)
            setContinueStory({ id: j.items[0].id, count: j.items[0].messages[0]?.idx ?? 0 });
        }
      }
    })();
  }, [id]);

  const start = async () => {
    if (!detail || starting) return;
    setStarting(true);
    if (me) {
      const r = await fetch("/api/stories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ situationId: id, introVariantId: introId }),
      });
      if (r.ok) {
        const story = await r.json();
        router.push(`/story/${story.id}`);
        return;
      }
      setStarting(false);
      return;
    }
    // 未ログイン: ゲスト体験(体験先行 [USER-REQ])
    const intro = detail.intros.find((i) => i.id === introId)!;
    localStorage.setItem(
      "bukucha_guest_story",
      JSON.stringify({
        situationId: id,
        introVariantId: introId,
        title: detail.title,
        introText: intro.introText,
        messages: [],
      })
    );
    router.push("/story/guest");
  };

  // 直リンクで開いた場合は履歴が無く router.back() が無反応になるため、ホームへ帰す
  const goBack = () => {
    if (window.history.length > 2 || document.referrer.startsWith(location.origin)) router.back();
    else router.push("/");
  };

  const toggleLike = async () => {
    if (!me) {
      router.push(`/login?returnTo=${encodeURIComponent(`/s/${id}`)}`);
      return;
    }
    const method = liked ? "DELETE" : "POST";
    const r = await fetch(`/api/situations/${id}/like`, { method });
    if (r.ok) {
      const j = await r.json();
      setLikeCount(j.likeCount);
      setLiked(!liked);
    }
  };

  if (errorMsg)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm">{errorMsg}</p>
        <Link href="/" className="btn-ghost">
          ホームへ
        </Link>
      </main>
    );

  if (!detail)
    return (
      <main className="space-y-4">
        <div className="skeleton h-[380px] w-full rounded-none" />
        <div className="space-y-3 px-4">
          <div className="skeleton h-6 w-3/4" />
          <div className="skeleton h-4 w-1/2" />
          <div className="skeleton h-24 rounded-[16px]" />
        </div>
      </main>
    );

  const mainChar = detail.characters[0];
  const selectedIntro = detail.intros.find((i) => i.id === introId) ?? detail.intros[0];

  return (
    <div className="flex min-h-dvh flex-col">
      {/* フローティングヘッダー(ヒーローの上に重なる) */}
      <header className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-[var(--shell-max)] items-center justify-between px-3 py-3">
        <button
          aria-label="戻る"
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-white"
          style={{ background: "rgb(0 0 0 / 0.35)", backdropFilter: "blur(4px)" }}
          onClick={goBack}
        >
          <ArrowLeft size={19} strokeWidth={1.9} />
        </button>
        <div className="flex items-center gap-2">
          <button
            data-testid="like-button"
            data-count={likeCount}
            data-liked={liked}
            onClick={toggleLike}
            className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-white"
            style={{ background: "rgb(0 0 0 / 0.35)", backdropFilter: "blur(4px)", transition: "color 0.2s ease" }}
          >
            <span key={String(liked)} className={`inline-flex ${liked ? "heart-pop" : ""}`}>
              <Heart
                size={15}
                fill={liked ? "var(--c-primary)" : "none"}
                style={{ color: liked ? "var(--c-primary)" : "#fff" }}
              />
            </span>
            {likeCount.toLocaleString()}
          </button>
          <div className="relative">
            <button
              aria-label="その他"
              className="flex h-9 w-9 items-center justify-center rounded-full text-white"
              style={{ background: "rgb(0 0 0 / 0.35)", backdropFilter: "blur(4px)" }}
              onClick={() => setReportOpen((v) => !v)}
            >
              <Ellipsis size={19} />
            </button>
            {reportOpen && (
              <div className="card absolute right-0 z-20 w-40 p-2">
                {reported ? (
                  <p className="p-2 text-xs">報告を受け付けました</p>
                ) : (
                  ["二次創作", "過度な性的表現", "実在人物", "その他"].map((reason) => (
                    <button
                      key={reason}
                      className="block w-full p-2 text-left text-xs hover:opacity-70"
                      onClick={async () => {
                        if (!me) {
                          router.push(`/login?returnTo=${encodeURIComponent(`/s/${id}`)}`);
                          return;
                        }
                        await fetch("/api/reports", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ targetType: "situation", targetId: id, reason }),
                        });
                        setReported(true);
                      }}
                    >
                      通報: {reason}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pb-40">
        {/* ヒーロービジュアル: 表紙をフルブリードに敷き、下端をbgへ溶かす */}
        <div className="relative">
          {detail.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={detail.coverImageUrl} alt="" className="h-[380px] w-full object-cover" />
          ) : (
            <div className="relative h-[380px] w-full overflow-hidden" style={{ background: coverGradient(detail.title) }}>
              <span
                aria-hidden
                className="absolute -right-4 top-6 select-none font-serif text-[9rem] leading-none text-white/10"
              >
                “
              </span>
              <p className="absolute left-6 top-16 max-w-[70%] font-serif text-lg leading-relaxed text-white/80">
                {detail.catchphrase}
              </p>
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-48"
            style={{ background: "linear-gradient(transparent, var(--c-bg) 92%)" }}
          />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-1">
            {detail.contentLevel === "R15" && (
              <span
                data-testid="r15-badge"
                className="mb-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                style={{ background: "var(--c-danger)" }}
              >
                R15
              </span>
            )}
            <h1
              data-testid="situation-title"
              className="font-serif text-[1.55rem] font-bold leading-snug"
              style={{ textShadow: "0 1px 8px rgb(0 0 0 / 0.18)" }}
            >
              {detail.title}
            </h1>
            <p className="mt-0.5 text-[0.8rem]" style={{ color: "var(--c-textMuted)" }}>
              {detail.catchphrase}
            </p>
          </div>
        </div>

        <div className="px-4">
          {/* 社会的証明 + 作者 */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8rem]" style={{ color: "var(--c-textMuted)" }}>
            <span data-testid="stat-stories">
              <MessageCircle size={13} className="inline align-[-2px]" />{" "}
              <b style={{ color: "var(--c-text)" }}>{fmtCount(detail.storyCount)}</b> 会話
            </span>
            <span>
              <BookOpen size={13} className="inline align-[-2px]" />{" "}
              <b style={{ color: "var(--c-text)" }}>{fmtCount(detail.readerCount)}</b> 読者
            </span>
            <span>
              <Heart size={13} className="inline align-[-2px]" />{" "}
              <b style={{ color: "var(--c-text)" }}>{fmtCount(likeCount)}</b>
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: coverGradient(detail.author.nickname) }}
            >
              {detail.author.nickname.slice(0, 1)}
            </span>
            <span className="text-xs" style={{ color: "var(--c-textMuted)" }}>
              {detail.author.nickname}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {detail.tags.map((t) => (
              <Link key={t.tag.id} href={`/search?tags=${encodeURIComponent(t.tag.name)}`} className="chip text-[11px]">
                #{t.tag.name}
              </Link>
            ))}
          </div>

          {/* 世界観 */}
          <section className="mt-6">
            <SectionTitle>世界観</SectionTitle>
            <p className={`novel mt-2 whitespace-pre-wrap text-[0.95rem] ${worldExpanded ? "" : "line-clamp-[8]"}`}>
              {detail.worldSetting}
            </p>
            {detail.worldSetting.length > 200 && !worldExpanded && (
              <button className="mt-1 text-xs" style={{ color: "var(--c-accent)" }} onClick={() => setWorldExpanded(true)}>
                もっと見る
              </button>
            )}
          </section>

          {/* 登場人物 */}
          <section className="mt-6">
            <SectionTitle>登場人物</SectionTitle>
            <div className="hide-scrollbar mt-2.5 flex gap-2.5 overflow-x-auto">
              {detail.characters.map((c) => (
                <button key={c.id} className="card flex w-44 shrink-0 items-start gap-2.5 p-3 text-left" onClick={() => setCharModal(c)}>
                  {c.profileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.profileImageUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-serif text-base font-bold text-white"
                      style={{ background: coverGradient(c.name) }}
                    >
                      {c.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{c.name}</span>
                    <span className="mt-0.5 line-clamp-3 block text-[10.5px] leading-relaxed" style={{ color: "var(--c-textMuted)" }}>
                      {c.relationship}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* 冒頭をのぞき見 */}
          <section className="mt-6">
            <SectionTitle>冒頭をのぞき見</SectionTitle>
            <div
              data-testid="intro-preview"
              className="relative mt-2.5 overflow-hidden rounded-xl p-4"
              style={{ background: "var(--c-novelBg)", border: "1px solid var(--c-border)" }}
            >
              {selectedIntro && (
                <p className="mb-2 text-[0.7rem] tracking-widest" style={{ color: "var(--c-textMuted)" }}>
                  ── {selectedIntro.label} ──
                </p>
              )}
              <p className="novel whitespace-pre-wrap text-[0.95rem]">{selectedIntro?.introText}</p>
              {mainChar && (
                <p className="mt-3 flex items-center gap-1.5 text-[0.72rem]" style={{ color: "var(--c-textMuted)" }}>
                  <span
                    aria-hidden
                    className="flex h-5 w-5 items-center justify-center rounded-full font-serif text-[0.6rem] font-bold text-white"
                    style={{ background: coverGradient(mainChar.name) }}
                  >
                    {mainChar.name.slice(0, 1)}
                  </span>
                  {mainChar.name}
                </p>
              )}
              <p className="novel mt-1 whitespace-pre-wrap text-[0.95rem]">{(selectedIntro?.firstMessage ?? "").slice(0, 160)}…</p>
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
                style={{ background: "linear-gradient(transparent, var(--c-novelBg))" }}
              />
            </div>
          </section>

          {/* 関連作品(同じタグの人気作) */}
          {related && related.length > 0 && (
            <section className="mt-6">
              <SectionTitle>こんな物語も</SectionTitle>
              <div className="hide-scrollbar mt-2.5 flex snap-x gap-3 overflow-x-auto pb-1">
                {related.map((r2) => (
                  <SituationCard key={r2.id} s={r2} testid="related-card" />
                ))}
              </div>
            </section>
          )}

          {detail.publishedAt && (
            <p className="mt-6 text-[0.7rem]" style={{ color: "var(--c-textMuted)" }}>
              公開: {fmtDateJa(detail.publishedAt)}
            </p>
          )}
        </div>
      </main>

      <footer
        className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[var(--shell-max)] space-y-2 border-t px-4 pt-3"
        style={{
          background: "var(--c-surface)",
          borderColor: "var(--c-border)",
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
        }}
      >
        {continueStory && (
          <Link href={`/story/${continueStory.id}`} className="block text-center text-xs" style={{ color: "var(--c-accent)" }}>
            つづきから読む(第{Math.max(1, Math.floor(continueStory.count / 2))}話)
          </Link>
        )}
        {detail.intros.length > 1 && (
          <fieldset className="space-y-1.5">
            <legend className="label">どこから始める?</legend>
            {detail.intros.map((i) => (
              <label
                key={i.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm"
                style={{
                  borderColor: introId === i.id ? "var(--c-primary)" : "var(--c-border)",
                  background: introId === i.id ? "color-mix(in oklab, var(--c-primarySoft) 55%, var(--c-surface))" : "var(--c-surface)",
                  transition: "border-color 0.15s ease, background 0.15s ease",
                }}
              >
                <input
                  type="radio"
                  name="intro"
                  aria-label={i.label}
                  checked={introId === i.id}
                  onChange={() => setIntroId(i.id)}
                  style={{ accentColor: "var(--c-primary)" }}
                />
                {i.label}
              </label>
            ))}
          </fieldset>
        )}
        <button className="btn-primary w-full" onClick={start} disabled={starting}>
          この物語をはじめる ▶
        </button>
      </footer>

      {charModal && (
        <div className="backdrop fixed inset-0 z-30 flex items-end justify-center" onClick={() => setCharModal(null)}>
          <div className="card sheet-up mx-auto w-full max-w-[var(--shell-max)] rounded-b-none p-5 pt-3" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grabber" aria-hidden />
            <div className="flex items-center gap-3">
              {charModal.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={charModal.profileImageUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <span
                  aria-hidden
                  className="flex h-14 w-14 items-center justify-center rounded-full font-serif text-xl font-bold text-white"
                  style={{ background: coverGradient(charModal.name) }}
                >
                  {charModal.name.slice(0, 1)}
                </span>
              )}
              <h3 className="text-lg font-bold">{charModal.name}</h3>
            </div>
            <p className="label mt-4">性格</p>
            <p className="text-sm leading-relaxed">{charModal.personality}</p>
            <p className="label mt-3">口調</p>
            <p className="text-sm leading-relaxed">{charModal.speechStyle}</p>
            <p className="label mt-3">主人公との関係</p>
            <p className="text-sm leading-relaxed">{charModal.relationship}</p>
            <button className="btn-ghost mt-4 w-full" onClick={() => setCharModal(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
