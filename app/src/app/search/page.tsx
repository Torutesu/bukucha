"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Cover, type CardData } from "@/components/StoryCard";

interface Tag {
  id: string;
  name: string;
  category: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  trope: "By trope",
  relationship: "By relationship",
  genre: "By genre",
  warning: "Content warnings",
};

// SCR-003: search and tags. Named search is the demand engine in this market,
// so this screen is the front door, not a filter panel.
function SearchInner() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const selectedTags = (params.get("tags") ?? "").split(",").filter(Boolean);
  const sort = params.get("sort") === "new" ? "new" : "popular";

  const [input, setInput] = useState(q);
  const [tags, setTags] = useState<Tag[]>([]);
  const [resultData, setResultData] = useState<{ key: string; items: CardData[] } | null>(null);
  const [error, setError] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executed = q.length > 0 || selectedTags.length > 0;

  const navigate = useCallback(
    (next: { q?: string; tags?: string[]; sort?: string }) => {
      const sp = new URLSearchParams();
      const nq = next.q ?? q;
      const nt = next.tags ?? selectedTags;
      const ns = next.sort ?? sort;
      if (nq) sp.set("q", nq);
      if (nt.length) sp.set("tags", nt.join(","));
      if (ns !== "popular") sp.set("sort", ns);
      router.replace(`/search?${sp.toString()}`);
    },
    [q, selectedTags, sort, router]
  );

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then(setTags)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!executed) return;
    fetch(
      `/api/search?q=${encodeURIComponent(q)}&tags=${encodeURIComponent(selectedTags.join(","))}&sort=${sort}`
    )
      .then((r) => r.json())
      .then((j) => {
        setError(false);
        setResultData({ key: `${q}|${selectedTags.join(",")}|${sort}`, items: j.items });
      })
      .catch(() => setError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, params.get("tags"), sort]);

  const resultKey = `${q}|${selectedTags.join(",")}|${sort}`;
  const results = resultData && resultData.key === resultKey ? resultData.items : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 px-4 pb-2 pt-4" style={{ background: "var(--c-bg)" }}>
        <div className="flex items-center gap-2">
          <button aria-label="Back" className="text-lg" onClick={() => router.push("/")}>
            ←
          </button>
          <input
            className="input"
            autoFocus
            placeholder="Search stories, tropes, creators"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => navigate({ q: e.target.value }), 300);
            }}
          />
        </div>
        {selectedTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedTags.map((t) => (
              <button
                key={t}
                data-testid="selected-tag"
                className="chip"
                data-on="true"
                onClick={() => navigate({ tags: selectedTags.filter((x) => x !== t) })}
              >
                <span>{t}</span> ×
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 px-4 pb-8">
        {!executed && (
          <div className="space-y-5 pt-2">
            {Object.entries(CATEGORY_LABEL).map(([cat, label]) => (
              <section key={cat}>
                <h2 className="mb-2 text-sm font-bold">{label}</h2>
                <div className="flex flex-wrap gap-2">
                  {tags
                    .filter((t) => t.category === cat)
                    .map((t) => (
                      <button
                        key={t.id}
                        data-testid="tag-option"
                        className="chip"
                        onClick={() => navigate({ tags: [...selectedTags, t.name] })}
                      >
                        {t.name}
                      </button>
                    ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {executed && (
          <>
            <div className="flex items-center gap-2 py-2">
              <span className="text-xs" style={{ color: "var(--c-textMuted)" }}>
                Sort:
              </span>
              <button
                className="chip"
                data-on={sort === "popular"}
                onClick={() => navigate({ sort: "popular" })}
              >
                Most played
              </button>
              <button
                className="chip"
                data-on={sort === "new"}
                onClick={() => navigate({ sort: "new" })}
              >
                Newest
              </button>
            </div>

            {/* Narrowing tags, always visible. */}
            <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
              {tags
                .filter((t) => !selectedTags.includes(t.name))
                .map((t) => (
                  <button
                    key={t.id}
                    data-testid="tag-option"
                    className="chip"
                    onClick={() => navigate({ tags: [...selectedTags, t.name] })}
                  >
                    <span aria-hidden>＋</span>
                    <span>{t.name}</span>
                  </button>
                ))}
            </div>

            {error && (
              <div className="card p-4 text-center text-sm">
                We could not run that search.
                <button className="btn-ghost mt-2 w-full" onClick={() => location.reload()}>
                  Try again
                </button>
              </div>
            )}
            {!error && !results && (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="card aspect-[3/4] animate-pulse" />
                ))}
              </div>
            )}
            {results && results.length === 0 && (
              <div data-testid="search-empty" className="card mt-4 p-5 text-center">
                <p className="text-sm">Nothing matched that.</p>
                <p className="mt-2 text-xs" style={{ color: "var(--c-textMuted)" }}>
                  Nobody has written this one yet. You could.
                </p>
                <Link
                  href={`/create?fantasy=${encodeURIComponent(q)}`}
                  className="btn-primary mt-3 block"
                >
                  Write it yourself
                </Link>
              </div>
            )}
            {results && results.length > 0 && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                {results.map((s) => (
                  <Link key={s.id} href={`/story/${s.id}`} data-testid="search-result" className="block">
                    <Cover s={s} />
                    <p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-tight">
                      {s.contentLevel === "TEEN" && (
                        <span
                          data-testid="teen-badge"
                          className="mr-1 rounded px-1 text-[10px] font-bold text-white"
                          style={{ background: "var(--c-danger)" }}
                        >
                          TEEN
                        </span>
                      )}
                      {s.title}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--c-textMuted)" }}>
                      📖 {s.playerCount.toLocaleString()} ♥ {s.likeCount.toLocaleString()}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}
