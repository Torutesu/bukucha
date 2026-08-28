export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

/** A profile bundles model, temperature and output handling. One per AI feature. */
export type LlmProfileKind =
  | "chat" // AIF-002 narration
  | "state" // AIF-001 + AIF-003 canon + stat extraction
  | "draft" // AIF-005 premise -> whole story
  | "summary" // rolling summary (memory layer 2)
  | "recap" // AIF-006 "Previously on..."
  | "judge"; // AIF-009 publish-time rating judgement

export interface LlmOptions {
  /** Attach branch choices to this response. */
  wantChoices?: boolean;
  /** Steering note for a re-roll. */
  instruction?: string;
  /** Expect a JSON body back. */
  json?: boolean;
  /** Quality tier for the narration profile. Ignored elsewhere. */
  tier?: "STANDARD" | "CINEMATIC";
  signal?: AbortSignal;
}

export interface LlmChunk {
  type: "token" | "blocked" | "done";
  token?: string;
  content?: string;
  choices?: { id: string; text: string }[];
  /** Mock provider only — lets the E2E suite assert on what reached the model. */
  debug?: Record<string, unknown>;
}

export interface LlmProvider {
  /** Streaming generation. Always ends with exactly one done or blocked chunk. */
  stream(
    profile: LlmProfileKind,
    messages: LlmMessage[],
    options?: LlmOptions
  ): AsyncGenerator<LlmChunk>;
  /** Non-streaming, for judgements and JSON payloads. */
  complete(
    profile: LlmProfileKind,
    messages: LlmMessage[],
    options?: LlmOptions
  ): Promise<string>;
}
