import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { requireOwnedSituation } from "@/server/situations";
import { buildChatMessages } from "@/lib/prompt";
import { llm } from "@/lib/llm";
import { sseResponse } from "@/server/sse";

type Params = { params: Promise<{ id: string }> };

/** SCR-009 Step4 テスト会話(非永続、本番同等のAIF-001) */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const s = await requireOwnedSituation(user, id);
    const b = await req.json();
    const history: { role: "USER" | "AI"; content: string }[] = Array.isArray(b.history)
      ? b.history.slice(-6)
      : [];
    if (history.length > 6) throw new HttpError(422, "too_long");
    const intro = s.intros[0];
    if (!intro) throw new HttpError(422, "intro_required");

    const messages = buildChatMessages({
      situation: s,
      intro,
      memory: null,
      persona: null,
      recentMessages: history.map((m) => ({ role: m.role, content: m.content })),
      expression: "ALL_AGES",
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
            data: { message: "この展開は表現ガイドラインに触れるため書けませんでした" },
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
