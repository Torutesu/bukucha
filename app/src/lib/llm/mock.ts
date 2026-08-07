import type { LlmChunk, LlmMessage, LlmOptions, LlmProfileKind, LlmProvider } from "./types";

/**
 * 決定的モックプロバイダ(E2E用)。04-e2e-cases.md冒頭の方針に従い、
 * ノベル形式応答 / 指示エコー / NGトリガー / 選択肢付与 / 遅延 を再現する。
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

function novelReply(messages: LlmMessage[], options?: LlmOptions): string {
  const sys = systemText(messages);
  const user = lastUserText(messages);
  const callNameMatch = sys.match(/呼び方:\s*([^\n]+)/);
  const callName = callNameMatch ? callNameMatch[1].trim() : "きみ";
  const parts: string[] = [];
  if (options?.instruction) {
    parts.push(`指示反映:${options.instruction}。`);
  }
  parts.push(
    `窓の外で雨音がひとつ、またひとつと重なっていく。彼はゆっくりとこちらを振り向いた。`
  );
  if (user && !user.startsWith("(")) {
    parts.push(`「${callName}——今、${user.slice(0, 24)}って言った?」`);
  } else {
    parts.push(`「${callName}、続きを聞かせて」`);
  }
  parts.push(`その声は低く、けれど確かに熱を帯びていた。`);
  return parts.join("");
}

export class MockLlmProvider implements LlmProvider {
  async *stream(
    profile: LlmProfileKind,
    messages: LlmMessage[],
    options?: LlmOptions
  ): AsyncGenerator<LlmChunk> {
    const user = lastUserText(messages);
    const sys = systemText(messages);

    if (user.includes("遅延トリガー")) {
      await sleep(25_000);
    }
    if (user.includes("NGトリガー")) {
      yield { type: "blocked" };
      return;
    }

    const content = novelReply(messages, options);
    const chunkSize = 6;
    for (let i = 0; i < content.length; i += chunkSize) {
      yield { type: "token", token: content.slice(i, i + chunkSize) };
      await sleep(8);
    }

    const choices = options?.wantChoices
      ? [
          { id: "a", text: "手を取る" },
          { id: "b", text: "目を逸らして走り去る" },
        ]
      : undefined;

    yield {
      type: "done",
      content,
      choices,
      debug: {
        hasUserNote: sys.includes("【ユーザーノート】") && !sys.includes("【ユーザーノート】\n(なし)"),
        hasSummary: sys.includes("【これまでのあらすじ】") && !sys.includes("【これまでのあらすじ】\n(なし)"),
        personaCallName: sys.match(/呼び方:\s*([^\n]+)/)?.[1]?.trim() ?? null,
        modelTier: options?.tier ?? "light",
      },
    };
  }

  async complete(
    profile: LlmProfileKind,
    messages: LlmMessage[],
    options?: LlmOptions
  ): Promise<string> {
    const user = lastUserText(messages);
    if (profile === "draft") {
      const fantasy = user.replace(/\s+/g, " ").trim();
      const short = fantasy.slice(0, 24);
      return JSON.stringify({
        title: `${short}${fantasy.length > 24 ? "…" : ""}`,
        catchphrase: `——それは、${short.slice(0, 12)}から始まる物語。`,
        worldSetting: `${fantasy}。\nここは身分と噂が全てを決める世界。主人公(あなた)は思いがけない形で彼と出会い、抗えない関係に巻き込まれていく。`,
        characters: [
          {
            name: "アルベルト",
            personality: "冷徹に見えて独占欲が強い。素直になれない。",
            speechStyle: "俺様口調。一人称は俺。命令形が多いが、ふとした時だけ敬語になる。",
            relationship: "あなたを買い取った公爵。契約上の主人。",
            exampleDialogs: [
              { user: "おはようございます", char: "「遅い。……まあいい、顔を見せろ」" },
            ],
          },
        ],
        intros: [
          {
            label: "契約の夜に",
            introText: `燭台の炎が揺れる書斎。羽根ペンの音が止まり、彼の視線がこちらへ向いた。`,
            firstMessage: `彼は契約書を指で叩き、口の端だけで笑った。「サインを。今夜からお前は、俺のものだ」`,
          },
        ],
        suggestedTags: ["身分差", "策略婚", "執着"],
      });
    }
    if (profile === "summary") {
      return `二人は出会い、距離を縮めつつある。直近では${user.slice(0, 30)}という出来事があった。`;
    }
    if (profile === "recap") {
      return `前回まで——彼の秘密に触れてしまったあなた。次の一言が、二人の関係を変えようとしている。`;
    }
    if (profile === "suggest") {
      // AIF-008: ユーザー側セリフ候補(決定的)。直近の実発言を織り込む(内部指示「(〜」は除外)
      const lastReal = [...messages]
        .reverse()
        .find((m) => m.role === "user" && !m.content.startsWith("("));
      const seed = (lastReal?.content ?? "").replace(/\s+/g, " ").slice(0, 12);
      return JSON.stringify({
        suggestions: [
          `「そんなふうに見つめられたら、困ります」*目を伏せる*`,
          `*一歩近づく* 「${seed ? `${seed}……` : "ねえ、"}本当のことを教えてください」`,
        ],
      });
    }
    if (profile === "judge") {
      // AIF-006/007のLLM判定モック: 常にpass(ルールベース前段が実検出を担う)
      return JSON.stringify({ ok: true, level: "ALL_AGES" });
    }
    return novelReply(messages, options);
  }
}
