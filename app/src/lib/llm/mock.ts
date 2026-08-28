import type { LlmChunk, LlmMessage, LlmOptions, LlmProfileKind, LlmProvider } from "./types";

/**
 * Deterministic mock provider for E2E.
 *
 * It reproduces every behaviour the suite depends on: second-person prose,
 * instruction echo on re-roll, a blocked-content trigger, a slow trigger, branch
 * choices, and structured state extraction. The `debug` payload lets tests
 * assert on what actually reached the model — that is how the Canon guarantee
 * (E2E-010) is verified rather than assumed.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function lastUserText(messages: LlmMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

function systemText(messages: LlmMessage[]): string {
  return messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
}

function section(sys: string, heading: string): string {
  const i = sys.indexOf(`## ${heading}`);
  if (i < 0) return "";
  const rest = sys.slice(i + heading.length + 3);
  const next = rest.indexOf("\n## ");
  return (next < 0 ? rest : rest.slice(0, next)).trim();
}

function prose(messages: LlmMessage[], options?: LlmOptions): string {
  const sys = systemText(messages);
  const user = lastUserText(messages);
  const called = sys.match(/called:\s*([^\n]+)/)?.[1]?.trim() || "you";
  const parts: string[] = [];
  if (options?.instruction) parts.push(`Steering: ${options.instruction}.`);
  parts.push("Rain gathers on the window, one line and then another, and he turns to face you.");
  if (user && !user.startsWith("(")) {
    parts.push(`"${called} — did you just say ${user.slice(0, 32)}?"`);
  } else {
    parts.push(`"${called}. Go on. I am listening."`);
  }
  parts.push("His voice is low, and there is heat under it that he does not bother to hide.");
  return parts.join(" ");
}

export class MockLlmProvider implements LlmProvider {
  async *stream(
    profile: LlmProfileKind,
    messages: LlmMessage[],
    options?: LlmOptions
  ): AsyncGenerator<LlmChunk> {
    const user = lastUserText(messages);
    const sys = systemText(messages);

    if (user.includes("SLOW_TRIGGER")) await sleep(25_000);
    if (user.includes("BLOCK_TRIGGER")) {
      yield { type: "blocked" };
      return;
    }

    const content = prose(messages, options);
    for (let i = 0; i < content.length; i += 8) {
      yield { type: "token", token: content.slice(i, i + 8) };
      await sleep(6);
    }

    const choices = options?.wantChoices
      ? [
          { id: "a", text: "Take his hand" },
          { id: "b", text: "Look away and leave" },
        ]
      : undefined;

    const canonBlock = section(sys, "ESTABLISHED CANON (settled fact — never contradict)");
    yield {
      type: "done",
      content,
      choices,
      debug: {
        tier: options?.tier ?? "STANDARD",
        hasUserNote: sys.includes("READER'S STANDING NOTE"),
        hasSummary: sys.includes("## STORY SO FAR") && !sys.includes("(this is the beginning)"),
        personaCallName: sys.match(/called:\s*([^\n]+)/)?.[1]?.trim() ?? null,
        canon: canonBlock && !canonBlock.startsWith("(nothing settled") ? canonBlock : "",
        canonCount: canonBlock.split("\n").filter((l) => l.trim().startsWith("- ")).length,
        hasStats: sys.includes("## CURRENT STATE"),
        worldNotes: sys.includes("## WORLD NOTES"),
      },
    };
  }

  async complete(
    profile: LlmProfileKind,
    messages: LlmMessage[],
    options?: LlmOptions
  ): Promise<string> {
    const user = lastUserText(messages);

    if (profile === "state") {
      // Echo a fact derived from the reader's own words so a test can assert
      // that what they said in turn N is still in context at turn N+20.
      const said = (user.match(/reader:\s*([^\n]*)/)?.[1] ?? "").trim();
      const named = said.match(/\bmy name is ([A-Za-z][A-Za-z' -]{1,30})/i)?.[1];
      const canon: { category: string; subject: string; statement: string }[] = [];
      if (named) {
        canon.push({
          category: "PERSON",
          subject: named,
          statement: `You told him your name is ${named}.`,
        });
      } else if (said && !said.startsWith("(")) {
        canon.push({
          category: "EVENT",
          subject: "you",
          statement: `You said: ${said.slice(0, 120)}`,
        });
      }
      const statKeys = [...systemText(messages).matchAll(/key "([a-z_]+)"/g)].map((m) => m[1]);
      const stats = statKeys.length
        ? [{ key: statKeys[0], delta: 5, reason: "you stayed when it would have been easier to go" }]
        : [];
      return JSON.stringify({ canon, stats });
    }

    if (profile === "draft") {
      const premise = user.replace(/\s+/g, " ").trim();
      const short = premise.slice(0, 40);
      return JSON.stringify({
        title: short + (premise.length > 40 ? "…" : ""),
        logline: `You did not ask for this, and it is already too late to refuse.`,
        worldSetting: `${premise}\n\nThe city runs on debts nobody writes down. You arrived with one, and the man who holds it does not intend to collect it in money.`,
        characters: [
          {
            name: "Aldric Vaun",
            personality: "Cold in public, possessive in private. Never says the true thing first.",
            speechStyle: "Clipped, imperative, formal only when he is losing.",
            relationship: "The man who bought your debt.",
            exampleDialogs: [
              { user: "Good morning.", char: "You are late. — Come here where I can see you." },
              { user: "Why me?", char: "Because everyone else would have run. Sit." },
            ],
          },
        ],
        intros: [
          {
            label: "The night of the contract",
            introText: "Candlelight, a study that smells of ink and rain, and a page waiting for your name.",
            firstMessage:
              "He taps the contract twice with one finger and does not look up. \"Sign. From tonight, you are mine to account for.\" The pen is already warm from his hand.",
            playGuide: "Type what you do in *asterisks*. Anything else is what you say out loud.",
          },
          {
            label: "One year later",
            introText: "The debt is paid. Neither of you has mentioned it.",
            firstMessage:
              "\"You could leave today,\" he says, without turning around. \"The ledger is clear.\" Outside, the rain has not stopped in three days.",
            playGuide: "Your choices move Trust. Watch how his voice changes as it climbs.",
          },
        ],
        stats: [
          {
            key: "trust",
            name: "Trust",
            icon: "◆",
            initialValue: 20,
            minValue: 0,
            maxValue: 100,
            changeRule: "Rises 5-12 when you are honest at a cost. Falls 5-15 when you conceal something he later discovers.",
            levels: [
              { name: "Wary", threshold: 0, prompt: "He answers questions with questions and never turns his back." },
              { name: "Thawing", threshold: 40, prompt: "He lets silences run without filling them defensively." },
              { name: "Bound", threshold: 75, prompt: "He says the true thing first, and it costs him visibly." },
            ],
          },
          {
            key: "standing",
            name: "Standing",
            icon: "▲",
            initialValue: 10,
            minValue: 0,
            maxValue: 100,
            changeRule: "Rises 5-10 when you are seen holding your own in public. Falls when you are protected.",
            levels: [
              { name: "Nobody", threshold: 0, prompt: "The household speaks over you." },
              { name: "Noticed", threshold: 45, prompt: "The household waits to see what you will say." },
              { name: "Feared", threshold: 80, prompt: "The household asks you first." },
            ],
          },
        ],
        endings: [
          {
            name: "The ledger closes",
            rarity: "N",
            minTurns: 30,
            prompt: "You leave with the debt paid and nothing else.",
            epilogue:
              "You walk out through the front door, which no one has ever done. The rain has stopped. Somewhere behind you a lamp goes out, and that is the whole of it.",
            hint: "There is always the door.",
            rules: [],
          },
          {
            name: "An honest winter",
            rarity: "R",
            minTurns: 14,
            prompt: "Trust has grown enough that he tells you the truth unprompted.",
            epilogue: "He tells you the thing he has never told anyone, and then he waits, which is the bravest part.",
            hint: "He is close to saying it first.",
            rules: [{ statKey: "trust", comparator: "GTE", value: 55 }],
          },
          {
            name: "The house answers to you",
            rarity: "SR",
            minTurns: 18,
            prompt: "You have taken standing in the household without losing his trust.",
            epilogue: "The steward brings the morning ledger to your side of the table. Nobody remarks on it. That is how you know.",
            hint: "The household is beginning to look at you first.",
            rules: [
              { statKey: "standing", comparator: "GTE", value: 60 },
              { statKey: "trust", comparator: "GTE", value: 50 },
            ],
          },
          {
            name: "Nothing owed, nothing withheld",
            rarity: "SSR",
            minTurns: 22,
            prompt: "Both trust and standing are high, and the debt is irrelevant to either of you.",
            epilogue:
              "He burns the contract in the study grate and neither of you says anything clever about it. Outside, for the first time in a year, it is clear.",
            hint: "Something is within reach that almost nobody reaches.",
            rules: [
              { statKey: "trust", comparator: "GTE", value: 80 },
              { statKey: "standing", comparator: "GTE", value: 70 },
            ],
          },
        ],
        keywords: [
          { keywords: ["contract", "ledger", "debt"], body: "The contract is a single page, and he keeps it in the study, unlocked." },
          { keywords: ["rain", "storm"], body: "It has rained every day since you arrived. He has not once remarked on it." },
          { keywords: ["steward", "household"], body: "The steward, Merrow, decides who is real in this house." },
        ],
        suggestedTags: ["slow burn", "enemies to lovers", "court intrigue"],
      });
    }

    if (profile === "summary") {
      return `You and he have circled each other since the contract. Most recently: ${user.slice(-160)}`;
    }
    if (profile === "recap") {
      return "Previously — you found the thing he did not mean for you to find, and said nothing. He has not stopped watching you since.";
    }
    if (profile === "judge") {
      return JSON.stringify({ ok: true, level: "ALL_AGES" });
    }
    return prose(messages, options);
  }
}
