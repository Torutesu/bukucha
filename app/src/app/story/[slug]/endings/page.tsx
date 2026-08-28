"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brand } from "@/lib/theme";

interface Collection {
  story: { id: string; title: string; slug: string };
  intros: {
    id: string;
    label: string;
    endings: {
      id: string;
      rarity: "N" | "R" | "SR" | "SSR";
      hint: string;
      reached: boolean;
      times: number;
      name: string | null;
      epilogue: string | null;
      firstReachedAt: string | null;
    }[];
  }[];
  total: number;
  got: number;
}

/**
 * SCR-022: the endings collection.
 *
 * The benchmark stacks cards for repeat endings and badges the top five, but
 * never shows what is still out there — so a rare ending reads as luck. Locked
 * cards here keep their name hidden and show their hint, which turns collecting
 * into something a reader can aim at.
 */
export default function EndingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Collection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/stories/${slug}/endings`);
      if (r.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(`/story/${slug}/endings`)}`);
        return;
      }
      if (!r.ok) {
        setError("We could not load this collection.");
        return;
      }
      setData(await r.json());
    })();
  }, [slug, router]);

  if (error)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm">{error}</p>
        <Link href="/" className="btn-ghost">
          Back to stories
        </Link>
      </main>
    );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-2 px-4 py-3">
        <button aria-label="Back" className="text-lg" onClick={() => router.back()}>
          ←
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{data?.story.title ?? "…"}</p>
          <p className="text-[11px]" style={{ color: "var(--c-textMuted)" }}>
            {data ? `${data.got} of ${data.total} endings found` : "Loading…"}
          </p>
        </div>
      </header>

      <main className="flex-1 space-y-6 px-4 pb-8">
        {!data &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-24 animate-pulse" />
          ))}

        {data?.intros.map((intro) => (
          <section key={intro.id}>
            <h2 className="label">{intro.label}</h2>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {intro.endings.map((e) => {
                const colour = brand.rarity[e.rarity].color;
                return (
                  <button
                    key={e.id}
                    data-testid={e.reached ? "ending-found" : "ending-locked"}
                    className="card p-3 text-left"
                    style={{
                      borderColor: colour,
                      opacity: e.reached ? 1 : 0.55,
                    }}
                    onClick={() => e.reached && setOpen(open === e.id ? null : e.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] uppercase tracking-[0.2em]"
                        style={{ color: colour }}
                      >
                        {brand.rarity[e.rarity].label}
                      </span>
                      {e.times > 1 && (
                        <span className="text-[10px]" style={{ color: "var(--c-textMuted)" }}>
                          ×{e.times}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-semibold">
                      {e.reached ? e.name : "Not yet found"}
                    </p>
                    <p className="mt-1 text-[11px] italic" style={{ color: "var(--c-textMuted)" }}>
                      {e.hint}
                    </p>
                    {open === e.id && e.epilogue && (
                      <p className="novel mt-3 whitespace-pre-wrap text-[0.9rem]">{e.epilogue}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {data && (
          <Link href={`/story/${data.story.slug}`} className="btn-primary block text-center">
            Play another route
          </Link>
        )}
      </main>
    </div>
  );
}
