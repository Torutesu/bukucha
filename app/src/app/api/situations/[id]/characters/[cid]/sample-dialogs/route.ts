import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { requireOwnedSituation } from "@/server/situations";
import { llm } from "@/lib/llm";

type Params = { params: Promise<{ id: string; cid: string }> };

const FALLBACK = [
  { user: "おはようございます", char: "「……ああ。今日も、来たんだな」" },
  { user: "何を考えてるの?", char: "「おまえには、まだ言えない」" },
  { user: "また明日ね", char: "「……待ってる。明日も、その先も」" },
];

export async function POST(_req: Request, { params }: Params) {
  try {
    const { id, cid } = await params;
    const user = await requireUser();
    const s = await requireOwnedSituation(user, id);
    const c = s.characters.find((ch) => ch.id === cid);
    if (!c) throw new HttpError(404, "not_found");
    try {
      const raw = await llm().complete("draft", [
        {
          role: "system",
          content:
            '性格と口調から会話例を3組生成しJSONのみ出力: {"dialogs":[{"user":"...","char":"..."}]}。charは「」セリフ形式。',
        },
        { role: "user", content: `性格: ${c.personality}\n口調: ${c.speechStyle}\n関係: ${c.relationship}` },
      ]);
      const parsed = JSON.parse(raw.replace(/^```json?\s*|```\s*$/g, ""));
      const dialogs = Array.isArray(parsed.dialogs) ? parsed.dialogs.slice(0, 3) : FALLBACK;
      return Response.json({ dialogs });
    } catch {
      // AIF-002c fallback: テンプレ例文
      return Response.json({ dialogs: FALLBACK, fallback: true });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
