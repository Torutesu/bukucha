import type { ContentLevel, User } from "@prisma/client";

/**
 * Content policy and safety. Every judgement lives here and is enforced
 * server-side; the client only renders the outcome.
 *
 * spec: pipeline/bukucha/spec/05-ai-features.md (AIF-009, AIF-010)
 * regulatory basis: NY GBL Art. 47, CA SB 243 — see research/na-market.md §3
 */

export function isAdult(user: Pick<User, "birthDate"> | null): boolean {
  if (!user?.birthDate) return false;
  const now = new Date();
  const b = user.birthDate;
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 18;
}

/** Under 18 — triggers the shorter break-reminder cadence required by CA SB 243. */
export function isMinor(user: Pick<User, "birthDate"> | null): boolean {
  return !!user?.birthDate && !isAdult(user);
}

/** Which content levels this user may be shown. MATURE is never served here. */
export function visibleLevels(
  user: Pick<User, "birthDate" | "matureOptIn"> | null
): ContentLevel[] {
  if (user && user.matureOptIn && isAdult(user)) return ["ALL_AGES", "TEEN"];
  return ["ALL_AGES"];
}

/** The rating profile handed to the narrator for this turn. */
export function ratingProfile(
  storyLevel: ContentLevel,
  user: Pick<User, "birthDate" | "matureOptIn"> | null
): "ALL_AGES" | "TEEN" {
  return storyLevel === "TEEN" && visibleLevels(user).includes("TEEN") ? "TEEN" : "ALL_AGES";
}

// ============ AIF-009: rule pass before the model ============

/**
 * Known-IP dictionary. Original work only — fan fiction is out of scope, and
 * unlike the benchmark we do not keep a "Fan Fiction" category while banning it
 * in policy. Production would back this with a maintained third-party list;
 * this is the representative set the E2E suite exercises.
 */
export const IP_DICTIONARY: string[] = [
  "naruto",
  "sasuke uchiha",
  "gojo satoru",
  "jujutsu kaisen",
  "demon slayer",
  "tanjiro kamado",
  "my hero academia",
  "one piece",
  "monkey d. luffy",
  "attack on titan",
  "levi ackerman",
  "harry potter",
  "hogwarts",
  "twisted wonderland",
  "genshin impact",
  "hatsune miku",
  "spider-man",
  "pokemon",
  "pikachu",
  "star wars",
];

/** Never permitted at any rating. */
export const BANNED_PATTERNS: { pattern: RegExp; label: string }[] = [
  {
    pattern:
      /\b(child|kid|minor|preteen|teen|schoolgirl|schoolboy|\d{1,2}[- ]?year[- ]?old)\b[^.]{0,40}\b(nude|naked|sex|sexual|aroused|molest)/i,
    label: "sexual content involving a minor",
  },
  { pattern: /\b(rape|raping|non-?con|noncon)\b/i, label: "non-consensual sexual content" },
  { pattern: /\b(incest|incestuous)\b/i, label: "incest" },
  { pattern: /\b(bestiality|zoophilia)\b/i, label: "bestiality" },
];

export interface RuleCheckResult {
  ipDetected: string[];
  banned: string[];
}

export function ruleCheck(text: string): RuleCheckResult {
  const hay = text.toLowerCase();
  const ipDetected = IP_DICTIONARY.filter((name) => hay.includes(name));
  const banned = BANNED_PATTERNS.filter(({ pattern }) => pattern.test(text)).map((b) => b.label);
  return { ipDetected, banned };
}

// ============ AIF-010: crisis detection (SCR-025) ============

/**
 * Detected on the reader's own input, not on the fiction. On a hit the model is
 * never called: generation stops and the resources below are shown instead.
 * Deliberately narrow — a story about grief is not a crisis, and false
 * positives that interrupt fiction teach readers to ignore the interstitial.
 */
const CRISIS_PATTERNS: RegExp[] = [
  /\bi\s+(want|wanna|am going|'m going)\s+to\s+(kill myself|die|end (it|my life))\b/i,
  /\bi\s+(don'?t|do not)\s+want\s+to\s+(live|be alive|exist)\s+(any\s?more|anymore)?\b/i,
  /\bi'?m\s+going\s+to\s+(hurt|cut)\s+myself\b/i,
  /\b(kill myself|killing myself|end my life|commit suicide|suicidal)\b/i,
  /\bthere'?s\s+no\s+(point|reason)\s+(in\s+)?(living|going on)\b/i,
];

export function detectCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => p.test(text));
}

export const CRISIS_RESOURCES = {
  headline: "Before the story goes on",
  body: "It sounds like you might be going through something painful right now. You deserve to talk to a person about it, not a narrator.",
  lines: [
    { region: "US", name: "988 Suicide & Crisis Lifeline", contact: "Call or text 988", href: "tel:988" },
    { region: "CA", name: "9-8-8 Suicide Crisis Helpline", contact: "Call or text 988", href: "tel:988" },
    { region: "US", name: "Crisis Text Line", contact: "Text HOME to 741741", href: "sms:741741" },
  ],
} as const;

// ============ Companion-chatbot disclosure cadence ============

/**
 * NY GBL Art. 47 requires a reminder that the user is talking to AI at least
 * every three hours of continued interaction. CA SB 243 adds break reminders
 * for minors; we use a shorter interval for them.
 */
export const DISCLOSURE_INTERVAL_MS = 3 * 60 * 60 * 1000;
export const MINOR_DISCLOSURE_INTERVAL_MS = 60 * 60 * 1000;

export function disclosureDue(
  lastDisclosureAt: Date,
  user: Pick<User, "birthDate"> | null,
  now: Date = new Date()
): boolean {
  const interval = isMinor(user) ? MINOR_DISCLOSURE_INTERVAL_MS : DISCLOSURE_INTERVAL_MS;
  return now.getTime() - lastDisclosureAt.getTime() >= interval;
}
