/** SSE helpers — see spec 03-api.md for the event contract. */
export type SseEvent =
  | { event: "token"; data: string }
  | { event: "choices"; data: { id: string; text: string }[] }
  | { event: "done"; data: Record<string, unknown> }
  | { event: "blocked"; data: { message: string } }
  /** Stat movements settled after the turn, with the reason shown to the reader. */
  | { event: "stats"; data: { key: string; name: string; icon: string; delta: number; reason: string }[] }
  /** An ending fired. The route is over. */
  | { event: "ending"; data: { id: string; name: string; rarity: string; epilogue: string } }
  /** Locked endings the reader is close to (AIF-004). Names stay hidden. */
  | { event: "radar"; data: { id: string; rarity: string; hint: string; progress: number }[] }
  /** Cinematic was requested but the quota is spent; the turn ran on Standard. */
  | { event: "tier"; data: { tier: string; downgraded: boolean; resetsAt: Date } }
  /** Companion-chatbot disclosure / break reminder (SCR-025). */
  | { event: "intermission"; data: { reason: string } }
  /** Crisis resources replaced generation entirely (AIF-010). */
  | { event: "crisis"; data: unknown }
  | { event: "error"; data: { code: string; message: string } };

export function sseResponse(generator: () => AsyncGenerator<SseEvent>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: SseEvent) => {
        controller.enqueue(
          encoder.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
        );
      };
      try {
        for await (const e of generator()) send(e);
      } catch (err) {
        console.error("SSE error", err);
        send({
          event: "error",
          data: { code: "generation_failed", message: "The story couldn't continue just then." },
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

/** Shared shape for the client-side parser. */
export interface SseDonePayload {
  message?: {
    idx: number;
    content: string;
    choices: { id: string; text: string }[] | null;
    tier?: string;
  };
  debug?: Record<string, unknown>;
}
