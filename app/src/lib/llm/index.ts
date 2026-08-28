import { MockLlmProvider } from "./mock";
import { OpenAICompatProvider } from "./openai";
import type { LlmProvider } from "./types";

let provider: LlmProvider | null = null;

/** Provider abstraction. Swapping the model vendor happens here and nowhere else. */
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
