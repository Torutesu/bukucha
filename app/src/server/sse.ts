/** SSEレスポンスヘルパ(03-api.md: token/choices/done/blocked/error) */
export type SseEvent =
  | { event: "token"; data: string }
  | { event: "choices"; data: { id: string; text: string }[] }
  | { event: "done"; data: Record<string, unknown> }
  | { event: "blocked"; data: { message: string } }
  | { event: "error"; data: { code: string; message: string } };

export function sseResponse(
  generator: () => AsyncGenerator<SseEvent>
): Response {
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
          data: { code: "generation_failed", message: "続きが書けませんでした" },
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

/** クライアント側SSEパーサ(fetch POSTで受ける用)と共通の型 */
export interface SseDonePayload {
  message?: { idx: number; content: string; choices: { id: string; text: string }[] | null };
  debug?: Record<string, unknown>;
}
