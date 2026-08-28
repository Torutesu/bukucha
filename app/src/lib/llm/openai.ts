import type { LlmChunk, LlmMessage, LlmOptions, LlmProfileKind, LlmProvider } from "./types";

/**
 * OpenAI-compatible (chat/completions) provider.
 *
 * Free readers get unlimited STANDARD turns, so the standard model's per-turn
 * cost is the constraint the whole pricing model rests on. Model ids are env
 * driven so the tier mapping can be retuned without a deploy of this file:
 *   LLM_BASE_URL, LLM_API_KEY, LLM_MODEL_STANDARD, LLM_MODEL_CINEMATIC
 */

const STANDARD = () => process.env.LLM_MODEL_STANDARD ?? "gpt-4o-mini";
const CINEMATIC = () => process.env.LLM_MODEL_CINEMATIC ?? STANDARD();

const MODEL_BY_PROFILE: Record<LlmProfileKind, (tier?: string) => string> = {
  chat: (tier) => (tier === "CINEMATIC" ? CINEMATIC() : STANDARD()),
  // Bookkeeping profiles are never charged to the reader, so they stay on the
  // cheapest model regardless of plan.
  state: () => STANDARD(),
  draft: () => CINEMATIC(),
  summary: () => STANDARD(),
  recap: () => STANDARD(),
  judge: () => STANDARD(),
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
        content: `Rewrite the previous turn in this direction: ${options.instruction}`,
      });
    }
    if (options?.wantChoices) {
      msgs.push({
        role: "system",
        content:
          'After the prose, on its own final line, output two contrasting next moves as JSON: CHOICES:[{"id":"a","text":"..."},{"id":"b","text":"..."}]. Each is something the reader could do, under 12 words, written in second person.',
      });
    }
    return {
      model: MODEL_BY_PROFILE[profile](options?.tier),
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
            // Never stream the CHOICES line into the prose.
            if (!full.includes("CHOICES:")) {
              yield { type: "token", token: delta };
            }
          }
        } catch {
          /* keep-alive frames and partial chunks */
        }
      }
    }
    let content = full;
    let choices: { id: string; text: string }[] | undefined;
    const m = full.match(/CHOICES:(\[[\s\S]*\])\s*$/);
    if (m) {
      content = full.slice(0, m.index).trimEnd();
      try {
        choices = JSON.parse(m[1]);
      } catch {
        // Fallback: the turn still reads fine without branch buttons.
        choices = undefined;
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
