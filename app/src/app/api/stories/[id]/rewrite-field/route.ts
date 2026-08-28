import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { requireOwnedStory } from "@/server/stories";
import { llm } from "@/lib/llm";

type Params = { params: Promise<{ id: string }> };

const FIELD_PROMPTS: Record<string, string> = {
  title: "Write one title under 60 characters — the kind a webnovel reader clicks. Output the title only.",
  logline: "Write one hook under 100 characters, second person, for the story card. Output the line only.",
  worldSetting: "Rewrite the world in 150-300 words: place, stakes, tone, and what makes it specific. Output the prose only.",
};

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const s = await requireOwnedStory(user, id);
    const { field, hint } = await req.json();
    const sys = FIELD_PROMPTS[String(field)];
    if (!sys) throw new HttpError(422, "invalid_field");
    const text = await llm().complete("draft", [
      {
        role: "system",
        content: `You are an editor for an interactive anime-style fiction platform. ${sys}`,
      },
      {
        role: "user",
        content: `title: ${s.title}\nlogline: ${s.logline}\nworld: ${s.worldSetting.slice(0, 2000)}\noriginal premise: ${s.aiDraftInput ?? ""}\n${hint ? `author's note: ${hint}` : ""}`,
      },
    ]);
    return Response.json({ text: text.trim() });
  } catch (e) {
    return errorResponse(e);
  }
}
