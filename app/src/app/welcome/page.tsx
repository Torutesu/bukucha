"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StoryCard, type CardData } from "@/components/StoryCard";
import { brand } from "@/lib/theme";

interface Tag {
  id: string;
  name: string;
}

// SCR-001: Onboarding. Taste first, sign-up later — the benchmark asks for
// an account before it shows you anything, and that is a conversion tax.
export default function WelcomePage() {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState<0 | 1>(0);
  const [cards, setCards] = useState<CardData[] | null>(null);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/tags?category=trope")
      .then((r) => r.json())
      .then(setTags)
      .catch(() => setError(true));
  }, []);

  const markVisited = () => {
    localStorage.setItem("hc_visited", "1");
    localStorage.setItem("hc_pref_tags", JSON.stringify(selected));
  };

  const toStep2 = async () => {
    markVisited();
    setStep(1);
    try {
      const r = await fetch(`/api/home/recommend?tags=${encodeURIComponent(selected.join(","))}`);
      const j = await r.json();
      setCards(j.items);
      setFallback(j.fallback);
    } catch {
      setError(true);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col px-5 py-10">
      <h1 className="text-center text-2xl font-bold" style={{ color: "var(--c-primary)" }}>
        {brand.name}
      </h1>
      <p className="mt-1 text-center text-sm" style={{ color: "var(--c-textMuted)" }}>
        {brand.tagline}
      </p>

      {error && (
        <div className="mt-10 text-center text-sm">
          We could not load your tropes.
          <button className="btn-ghost mt-3 block w-full" onClick={() => location.reload()}>
            Try again
          </button>
        </div>
      )}

      {!error && step === 0 && (
        <>
          <h2 className="mt-10 text-lg font-bold">What are you here for?</h2>
          <p className="text-xs" style={{ color: "var(--c-textMuted)" }}>
            Pick as many as you like. You can change this later.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!tags &&
              Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="chip h-8 w-20 animate-pulse" />
              ))}
            {tags?.map((t) => (
              <button
                key={t.id}
                data-testid="onboarding-tag"
                className="chip"
                data-on={selected.includes(t.name)}
                onClick={() =>
                  setSelected((prev) =>
                    prev.includes(t.name) ? prev.filter((x) => x !== t.name) : [...prev, t.name]
                  )
                }
              >
                {t.name}
              </button>
            ))}
          </div>
          <button
            className="btn-primary mt-auto w-full disabled:opacity-40"
            disabled={selected.length === 0}
            onClick={toStep2}
          >
            Show me something
          </button>
        </>
      )}

      {!error && step === 1 && (
        <>
          <h2 className="mt-10 text-lg font-bold">
            {fallback ? "What people are playing" : "Start with one of these"}
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {!cards &&
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card aspect-[3/4] animate-pulse" />
              ))}
            {cards?.map((s) => (
              <StoryCard key={s.id} s={s} testid="recommend-card" />
            ))}
          </div>
          <button
            className="btn-ghost mt-auto w-full"
            onClick={() => {
              markVisited();
              router.push("/");
            }}
          >
            Browse everything instead
          </button>
        </>
      )}
    </main>
  );
}
