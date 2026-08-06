import type { LlmChunk, LlmMessage, LlmOptions, LlmProfileKind, LlmProvider } from "./types";

/**
 * OpenAI互換API(chat/completions)プロバイダ。
 * 超低価格モデル前提(decisions.md #3)。ベースURL/モデルIDは環境変数で切替:
 *   LLM_BASE_URL, LLM_API_KEY, LLM_MODEL_LIGHT, LLM_MODEL_MID
 * 派生(R18)ではここのルーティングでNSFW許容プロバイダに切替える(05-ai-features 横断事項)。
 */

const MODEL_BY_PROFILE: Record<LlmProfileKind, () => string> = {
  chat: () => process.env.LLM_MODEL_LIGHT ?? "gpt-4o-mini",
  draft: () => process.env.LLM_MODEL_MID ?? process.env.LLM_MODEL_LIGHT ?? "gpt-4o-mini",
  summary: () => process.env.LLM_MODEL_LIGHT ?? "gpt-4o-mini",
  recap: () => process.env.LLM_MODEL_LIGHT ?? "gpt-4o-mini",
  judge: () => process.env.LLM_MODEL_LIGHT ?? "gpt-4o-mini",
};

export class OpenAICompatProvider implements LlmProvider {
  private baseUrl = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
  private apiKey = process.env.LLM_API_KEY ?? "";

  private buildBody(
    profile: LlmProfileKind,
    messages: LlmMessage[],
    options: LlmOptions | undefined,
    stream: boolean
  ) {
    const msgs = [...messages];
    if (options?.instruction) {
      msgs.push({
        role: "system",
        content: `直前の応答を次の方向で書き直してください: ${options.instruction}`,
      });
    }
    if (options?.wantChoices) {
      msgs.push({
        role: "system",
        content:
          '応答本文の後に必ず改行し、最終行に選択肢を JSON で出力: CHOICES:[{"id":"a","text":"..."},{"id":"b","text":"..."}] 対照的な2方向。',
      });
    }
    return {
      model: MODEL_BY_PROFILE[profile](),
      messages: msgs,
      temperature: profile === "chat" ? 0.9 : profile === "judge" ? 0 : 0.7,
      stream,
      ...(options?.json ? { response_format: { type: "json_object" } } : {}),
    };
  }

  async *stream(
    profile: LlmProfileKind,
    messages: LlmMessage[],
    options?: LlmOptions
  ): AsyncGenerator<LlmChunk> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(this.buildBody(profile, messages, options, true)),
      signal: options?.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`LLM error: ${res.status} ${await res.text().catch(() => "")}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const delta: string = json.choices?.[0]?.delta?.content ?? "";
          if (delta) {
            full += delta;
            // CHOICES行はUIに流さない
            if (!full.includes("CHOICES:")) {
              yield { type: "token", token: delta };
            }
          }
        } catch {
          /* keep-alive等は無視 */
        }
      }
    }
    let content = full;
    let choices: { id: string; text: string }[] | undefined;
    const m = full.match(/CHOICES:(\[.*\])\s*$/s);
    if (m) {
      content = full.slice(0, m.index).trimEnd();
      try {
        choices = JSON.parse(m[1]);
      } catch {
        choices = undefined; // AIF-005 fallback: 選択肢なしで劣化なし
      }
    }
    yield { type: "done", content, choices };
  }

  async complete(
    profile: LlmProfileKind,
    messages: LlmMessage[],
    options?: LlmOptions
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(this.buildBody(profile, messages, options, false)),
      signal: options?.signal,
    });
    if (!res.ok) throw new Error(`LLM error: ${res.status}`);
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? "";
  }
}
