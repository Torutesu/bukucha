/**
 * Public story URLs are the discovery surface: in this market people search for
 * a title or a character, not for an app. Slugs must therefore be readable,
 * stable, and unique.
 */
const RESERVED = new Set(["new", "edit", "draft", "api", "me", "search", "library", "play"]);

export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base && !RESERVED.has(base) ? base : "story";
}

/** Short, collision-resistant suffix. Keeps slugs unique without a lookup loop. */
export function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function storySlug(title: string): string {
  return `${slugify(title)}-${shortId()}`;
}

/** @handle for a creator page. Derived from an email local part or display name. */
export function handleFrom(seed: string): string {
  const base = seed
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "")
    .slice(0, 18);
  return `${base || "reader"}${shortId().slice(0, 4)}`;
}
