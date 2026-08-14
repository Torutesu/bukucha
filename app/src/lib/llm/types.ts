export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

/** プロファイル = モデル×温度×出力フィルタ水準の束。AIFごとに定義(05-ai-features.md) */
export type LlmProfileKind =
  | "chat" // AIF-001 ノベル応答
  | "draft" // AIF-002 妄想→下書き(mid)
  | "summary" // AIF-003
  | "recap" // AIF-004
  | "judge" // AIF-006/007 判定
  | "suggest"; // AIF-008 返信候補

export interface LlmOptions {
  /** 選択肢を添付するか(AIF-005) */
  wantChoices?: boolean;
  /** モデル段の上書き(Story.useMidModel。既定はプロファイル定義に従う) */
  tier?: "light" | "mid";
  /** リロール時の方向指示 */
  instruction?: string;
  /** JSON出力を期待する */
  json?: boolean;
  signal?: AbortSignal;
}

export interface LlmChunk {
  type: "token" | "blocked" | "done";
  token?: string;
  content?: string;
  choices?: { id: string; text: string }[];
  /** mockプロバイダのみ: E2E検証用 */
  debug?: Record<string, unknown>;
}

export interface LlmProvider {
  /** ストリーミング生成。最後に必ず done か blocked を1回emitする */
  stream(
    profile: LlmProfileKind,
    messages: LlmMessage[],
    options?: LlmOptions
  ): AsyncGenerator<LlmChunk>;
  /** 非ストリーミング(判定・JSON用) */
  complete(
    profile: LlmProfileKind,
    messages: LlmMessage[],
    options?: LlmOptions
  ): Promise<string>;
}
