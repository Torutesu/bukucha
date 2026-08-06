"use client";

/** fetch POSTでSSEを受けるクライアント(03-api.md: token/choices/done/blocked/error) */
export interface SseHandlers {
  onToken?: (t: string) => void;
  onDone?: (data: {
    message?: { idx: number; content: string; choices: { id: string; text: string }[] | null };
  }) => void;
  onBlocked?: (message: string) => void;
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
        j?.error?.message ?? "エラーが発生しました"
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
          handlers.onBlocked?.((data as { message?: string })?.message ?? "生成できませんでした");
        else if (event === "error") {
          const d = data as { code?: string; message?: string };
          handlers.onError?.(d?.code ?? "error", d?.message ?? "エラーが発生しました");
        }
      }
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      handlers.onError?.("timeout", "時間がかかりすぎています");
    } else {
      handlers.onError?.("network", "通信に失敗しました");
    }
  } finally {
    clearTimeout(timer);
  }
}
