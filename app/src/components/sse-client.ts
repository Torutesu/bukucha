"use client";

/** SSE over fetch POST. Event contract: spec 03-api.md. */
export interface SseHandlers {
  onToken?: (t: string) => void;
  onDone?: (data: {
    message?: { idx: number; content: string; choices: { id: string; text: string }[] | null };
  }) => void;
  onBlocked?: (message: string) => void;
  onStats?: (d: { key: string; name: string; icon: string; delta: number; reason: string }[]) => void;
  onEnding?: (d: { id: string; name: string; rarity: string; epilogue: string }) => void;
  onRadar?: (d: { id: string; rarity: string; hint: string; progress: number }[]) => void;
  onTier?: (d: { tier: string; downgraded: boolean; resetsAt: string }) => void;
  onIntermission?: (d: { reason: string }) => void;
  onCrisis?: (d: { headline: string; body: string; lines: { name: string; contact: string; href: string }[] }) => void;
  onError?: (code: string, message: string) => void;
}

export async function postSse(
  url: string,
  body: unknown,
  handlers: SseHandlers,
  timeoutMs = 20_000
): Promise<void> {
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), timeoutMs);
  const bump = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), timeoutMs);
  };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      handlers.onError?.(
        j?.error?.code ?? String(res.status),
        j?.error?.message ?? "Something went wrong."
      );
      return;
    }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bump();
      buf += decoder.decode(value, { stream: true });
      const events = buf.split("\n\n");
      buf = events.pop() ?? "";
      for (const raw of events) {
        const lines = raw.split("\n");
        const event = lines.find((l) => l.startsWith("event: "))?.slice(7) ?? "message";
        const dataLine = lines.find((l) => l.startsWith("data: "))?.slice(6) ?? "null";
        let data: unknown = null;
        try {
          data = JSON.parse(dataLine);
        } catch {
          /* ignore */
        }
        if (event === "token" && typeof data === "string") handlers.onToken?.(data);
        else if (event === "done") handlers.onDone?.(data as Parameters<NonNullable<SseHandlers["onDone"]>>[0]);
        else if (event === "blocked")
          handlers.onBlocked?.((data as { message?: string })?.message ?? "That turn could not be written.");
        else if (event === "stats") handlers.onStats?.(data as Parameters<NonNullable<SseHandlers["onStats"]>>[0]);
        else if (event === "ending") handlers.onEnding?.(data as Parameters<NonNullable<SseHandlers["onEnding"]>>[0]);
        else if (event === "radar") handlers.onRadar?.(data as Parameters<NonNullable<SseHandlers["onRadar"]>>[0]);
        else if (event === "tier") handlers.onTier?.(data as Parameters<NonNullable<SseHandlers["onTier"]>>[0]);
        else if (event === "intermission") handlers.onIntermission?.(data as { reason: string });
        else if (event === "crisis")
          handlers.onCrisis?.(data as Parameters<NonNullable<SseHandlers["onCrisis"]>>[0]);
        else if (event === "error") {
          const d = data as { code?: string; message?: string };
          handlers.onError?.(d?.code ?? "error", d?.message ?? "Something went wrong.");
        }
      }
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      handlers.onError?.("timeout", "This is taking longer than it should.");
    } else {
      handlers.onError?.("network", "Could not reach the server.");
    }
  } finally {
    clearTimeout(timer);
  }
}
