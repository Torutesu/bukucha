"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Clock3, Gem, Menu, Share2, Sparkles } from "lucide-react";
import { BottomTab } from "@/components/BottomTab";
import { SituationCard, type CardData } from "@/components/SituationCard";

interface Me {
  id: string;
  nickname: string;
  handle: string | null;
  bio: string | null;
  avatarUrl: string | null;
}

// SCR-014: マイページ(Zeta型)
export default function MyPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [likes, setLikes] = useState<CardData[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/me");
      if (r.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent("/me")}`);
        return;
      }
      setMe(await r.json());
      const lr = await fetch("/api/me/likes");
      if (lr.ok) setLikes((await lr.json()).items);
    })();
  }, [router]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const shareProfile = async () => {
    const url = `${location.origin}/me`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${me?.nickname}のプロフィール`, url });
        return;
      }
    } catch {
      /* cancelled */
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    notify("リンクをコピーしました");
  };

  if (!me)
    return (
      <div className="flex min-h-dvh flex-col">
        <main className="flex-1 space-y-4 p-4">
          <div className="card h-40 animate-pulse" />
          <div className="card h-16 animate-pulse" />
        </main>
        <BottomTab />
      </div>
    );

  const handle = me.handle ?? `user_${me.id.slice(-8)}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-12 items-center justify-between px-4">
        <h1 className="text-lg font-bold">マイページ</h1>
        <div className="flex items-center gap-1">
          <button aria-label="お知らせ" className="icon-btn" onClick={() => notify("お知らせは準備中です")}>
            <Bell size={20} />
          </button>
          <Link href="/me/details" aria-label="詳細" className="icon-btn">
            <Menu size={20} />
          </Link>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-4 py-3">
        {/* プロフィールカード */}
        <section className="card p-4">
          <div className="flex items-center gap-3">
            {me.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
                style={{ background: "var(--c-primarySoft)", color: "var(--c-primary)" }}
              >
                {me.nickname.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold">{me.nickname}</p>
              <p className="truncate text-xs" style={{ color: "var(--c-textMuted)" }}>
                @{handle}
              </p>
              <div className="mt-1 flex gap-4 text-xs" style={{ color: "var(--c-textMuted)" }}>
                <span>
                  <b style={{ color: "var(--c-text)" }}>0</b> フォロワー
                </span>
                <span>
                  <b style={{ color: "var(--c-text)" }}>0</b> フォロー中
                </span>
                <span>
                  <b style={{ color: "var(--c-text)" }}>{likes.length}</b> いいね
                </span>
              </div>
            </div>
          </div>
          {me.bio && <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed">{me.bio}</p>}
          <div className="mt-3 flex gap-2">
            <button className="btn-ghost flex-1 py-2 text-sm" onClick={shareProfile}>
              <Share2 size={14} className="mr-1 inline align-[-2px]" /> プロフィール共有
            </button>
            <Link href="/me/edit" className="btn-ghost flex-1 py-2 text-center text-sm">
              プロフィール編集
            </Link>
          </div>
        </section>

        {/* Bukuchaパス バナー */}
        <button
          className="flex w-full items-center gap-3 rounded-[16px] p-4 text-left"
          style={{ background: "linear-gradient(105deg, var(--c-primarySoft), var(--c-surface))" }}
          onClick={() => notify("Bukuchaパスは準備中です")}
        >
          <Sparkles size={22} style={{ color: "var(--c-primary)" }} />
          <span className="flex-1">
            <span className="block text-sm font-bold">Bukuchaパスで物語をもっと自由に</span>
            <span className="block text-[11px]" style={{ color: "var(--c-textMuted)" }}>
              高性能モデル・無制限トークほか
            </span>
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: "var(--c-primary)", color: "#fff" }}
          >
            準備中
          </span>
        </button>

        {/* マイピース */}
        <section className="card p-4">
          <div className="flex items-center gap-2">
            <Gem size={18} style={{ color: "var(--c-primary)" }} />
            <p className="flex-1 text-sm font-bold">
              マイピース <span className="ml-1 text-base">0</span>
            </p>
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => notify("履歴は準備中です")}>
              <Clock3 size={12} className="mr-1 inline align-[-2px]" />
              履歴
            </button>
            <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => notify("チャージは準備中です")}>
              チャージ
            </button>
          </div>
        </section>

        {/* いいねした物語(E2E-019) */}
        {likes.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold">いいねした物語</h2>
            </div>
            <div data-testid="liked-row" className="hide-scrollbar flex gap-3 overflow-x-auto">
              {likes.map((s) => (
                <SituationCard key={s.id} s={s} />
              ))}
            </div>
          </section>
        )}

        {/* フッター(会社・規約リンク) */}
        <footer className="space-y-2 pb-2 pt-4 text-[11px]" style={{ color: "var(--c-textMuted)" }}>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/legal/terms">利用規約</Link>
            <Link href="/legal/privacy">プライバシーポリシー</Link>
            <Link href="/legal/guideline">コンテンツガイドライン</Link>
            <Link href="/legal/tokushoho">特定商取引法に基づく表記</Link>
          </div>
          <p>© Bukucha</p>
        </footer>
      </main>
      <BottomTab />

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center">
          <span className="rounded-full bg-black/80 px-4 py-2 text-xs text-white">{toast}</span>
        </div>
      )}
    </div>
  );
}
