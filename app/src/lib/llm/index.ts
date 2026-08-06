import { MockLlmProvider } from "./mock";
import { OpenAICompatProvider } from "./openai";
import type { LlmProvider } from "./types";

let provider: LlmProvider | null = null;

/** LLM抽象化レイヤ(05-ai-features.md)。envで実装を切替 */
export function llm(): LlmProvider {
  if (!provider) {
    provider =
      process.env.LLM_PROVIDER === "mock"
        ? new MockLlmProvider()
        : new OpenAICompatProvider();
  }
  return provider;
}

export * from "./types";
