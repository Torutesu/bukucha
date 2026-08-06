"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cover } from "@/components/SituationCard";

interface Detail {
  id: string;
  title: string;
  catchphrase: string;
  worldSetting: string;
  coverImageUrl: string | null;
  contentLevel: "ALL_AGES" | "R15" | "R18";
  likeCount: number;
  readerCount: number;
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
  intros: { id: string; label: string; introText: string }[];
  tags: { tag: { id: string; name: string } }[];
}

// SCR-005: 作品詳細(あらすじページ)
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
      <main className="space-y-4 px-4 py-6">
        <div className="card mx-auto aspect-[3/4] w-48 animate-pulse" />
        <div className="card h-6 animate-pulse" />
        <div className="card h-24 animate-pulse" />
      </main>
    );

  const previewText = detail.intros[0]?.introText.slice(0, 400) ?? "";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3" style={{ background: "var(--c-bg)" }}>
        <button aria-label="戻る" className="text-lg" onClick={() => router.back()}>
          ←
        </button>
        <div className="flex items-center gap-3">
          <button
            data-testid="like-button"
            data-count={likeCount}
            data-liked={liked}
            onClick={toggleLike}
            className="text-sm"
            style={{ color: liked ? "var(--c-primary)" : "var(--c-textMuted)" }}
          >
            ♥ {likeCount.toLocaleString()}
          </button>
          <div className="relative">
            <button aria-label="その他" onClick={() => setReportOpen((v) => !v)}>
              ⋯
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

      <main className="flex-1 px-4 pb-36">
        <div className="mx-auto w-48">
          <Cover s={detail} />
        </div>
        <h1 data-testid="situation-title" className="mt-4 text-xl font-bold leading-snug">
          {detail.title}
        </h1>
        <p className="mt-1 text-xs" style={{ color: "var(--c-textMuted)" }}>
          by {detail.author.nickname} ・ 📖 {detail.readerCount.toLocaleString()}読者
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {detail.contentLevel === "R15" && (
            <span
              data-testid="r15-badge"
              className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
              style={{ background: "var(--c-danger)" }}
            >
              R15 🔞
            </span>
          )}
          {detail.tags.map((t) => (
            <Link key={t.tag.id} href={`/search?tags=${encodeURIComponent(t.tag.name)}`} className="chip text-[11px]">
              {t.tag.name}
            </Link>
          ))}
        </div>

        <section className="mt-5">
          <h2 className="text-sm font-bold">── 世界観 ──</h2>
          <p
            className={`novel mt-2 whitespace-pre-wrap text-[0.95rem] ${worldExpanded ? "" : "line-clamp-[8]"}`}
          >
            {detail.worldSetting}
          </p>
          {detail.worldSetting.length > 200 && !worldExpanded && (
            <button className="mt-1 text-xs" style={{ color: "var(--c-accent)" }} onClick={() => setWorldExpanded(true)}>
              もっと見る
            </button>
          )}
        </section>

        <section className="mt-5">
          <h2 className="text-sm font-bold">── 登場人物 ──</h2>
          <div className="mt-2 flex gap-3">
            {detail.characters.map((c) => (
              <button key={c.id} className="card w-28 p-2 text-left" onClick={() => setCharModal(c)}>
                <p className="text-sm font-semibold">{c.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[10px]" style={{ color: "var(--c-textMuted)" }}>
                  {c.relationship}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5">
          <h2 className="text-sm font-bold">── 冒頭をのぞき見 ──</h2>
          <div data-testid="intro-preview" className="relative mt-2 overflow-hidden rounded-xl p-4" style={{ background: "var(--c-novelBg)", border: "1px solid var(--c-border)" }}>
            <p className="novel whitespace-pre-wrap">{previewText}…</p>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
              style={{ background: "linear-gradient(transparent, var(--c-novelBg))" }}
            />
          </div>
        </section>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[var(--shell-max)] space-y-2 border-t px-4 py-3" style={{ background: "var(--c-surface)", borderColor: "var(--c-border)" }}>
        {continueStory && (
          <Link
            href={`/story/${continueStory.id}`}
            className="block text-center text-xs"
            style={{ color: "var(--c-accent)" }}
          >
            つづきから読む(第{Math.max(1, Math.floor(continueStory.count / 2))}話)
          </Link>
        )}
        {detail.intros.length > 1 && (
          <fieldset className="space-y-1">
            <legend className="label">どこから始める?</legend>
            {detail.intros.map((i) => (
              <label key={i.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="intro"
                  aria-label={i.label}
                  checked={introId === i.id}
                  onChange={() => setIntroId(i.id)}
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
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50" onClick={() => setCharModal(null)}>
          <div className="card mx-auto w-full max-w-[var(--shell-max)] rounded-b-none p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{charModal.name}</h3>
            <p className="label mt-3">性格</p>
            <p className="text-sm">{charModal.personality}</p>
            <p className="label mt-3">口調</p>
            <p className="text-sm">{charModal.speechStyle}</p>
            <p className="label mt-3">主人公との関係</p>
            <p className="text-sm">{charModal.relationship}</p>
            <button className="btn-ghost mt-4 w-full" onClick={() => setCharModal(null)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
