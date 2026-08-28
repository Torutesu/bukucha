import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { requireOwnedStory } from "@/server/stories";
import { llm } from "@/lib/llm";

type Params = { params: Promise<{ id: string; cid: string }> };

const FALLBACK = [
  { user: "Good morning.", char: "You came back. — Sit down before you say anything else." },
  { user: "What are you thinking about?", char: "Nothing I am willing to tell you yet." },
  { user: "See you tomorrow.", char: "Tomorrow. And the day after that, presumably." },
];

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id, cid } = await params;
    const user = await requireUser();
    const s = await requireOwnedStory(user, id);
    const c = s.characters.find((ch) => ch.id === cid);
    if (!c) throw new HttpError(404, "not_found");
    try {
      const raw = await llm().complete("draft", [
        {
          role: "system",
          content:
            'From the personality and voice, write 3 short exchanges that show how this character speaks. Output JSON only: {"dialogs":[{"user":"...","char":"..."}]}. Show the voice, not the plot.',
        },
        {
          role: "user",
          content: `personality: ${c.personality}\nvoice: ${c.speechStyle}\nrelationship: ${c.relationship}`,
        },
      ]);
      const parsed = JSON.parse(raw.replace(/^```json?\s*|```\s*$/g, ""));
      const dialogs = Array.isArray(parsed.dialogs) ? parsed.dialogs.slice(0, 3) : FALLBACK;
      return Response.json({ dialogs });
    } catch {
      // Fallback: a neutral template beats an empty builder field.
      return Response.json({ dialogs: FALLBACK, fallback: true });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
