import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { requireOwnedStory } from "@/server/stories";
import { buildChatMessages } from "@/lib/prompt";
import { llm } from "@/lib/llm";
import { sseResponse } from "@/server/sse";

type Params = { params: Promise<{ id: string }> };

/** SCR-009: test-play from inside the builder. Not persisted, same pipeline as live. */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const s = await requireOwnedStory(user, id);
    const b = await req.json();
    const history: { role: "USER" | "AI"; content: string }[] = Array.isArray(b.history)
      ? b.history.slice(-6)
      : [];
    if (history.length > 6) throw new HttpError(422, "too_long");
    const intro = s.intros[0];
    if (!intro) throw new HttpError(422, "intro_required");

    const messages = buildChatMessages({
      story: s,
      intro,
      memory: null,
      canon: [],
      stats: [],
      keywords: [],
      persona: null,
      recentMessages: history.map((m) => ({ role: m.role, content: m.content })),
      rating: "ALL_AGES",
      userInput: String(b.content ?? ""),
    });

    return sseResponse(async function* () {
      let full = "";
      for await (const chunk of llm().stream("chat", messages, {})) {
        if (chunk.type === "token" && chunk.token) {
          full += chunk.token;
          yield { event: "token" as const, data: chunk.token };
        } else if (chunk.type === "blocked") {
          yield {
            event: "blocked" as const,
            data: { message: "That turn crosses a line we hold, so the story didn't take it." },
          };
          return;
        } else if (chunk.type === "done") {
          full = chunk.content ?? full;
        }
      }
      yield { event: "done" as const, data: { message: { idx: history.length + 1, content: full, choices: null } } };
    });
  } catch (e) {
    return errorResponse(e);
  }
}
