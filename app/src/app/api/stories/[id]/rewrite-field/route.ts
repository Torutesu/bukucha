import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { requireOwnedStory } from "@/server/stories";
import { llm } from "@/lib/llm";

type Params = { params: Promise<{ id: string }> };

const FIELD_PROMPTS: Record<string, string> = {
  title: "女性向けWeb小説の定番構文でタイトルを60字以内で1つ。出力はタイトルのみ。",
  logline: "作品カード用のひとこと紹介を60字以内で1つ。出力は本文のみ。",
  worldSetting: "世界観・設定を400〜800字で書き直す。出力は本文のみ。",
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
      { role: "system", content: `あなたは女性向けライトノベルの編集者AIです。${sys}` },
      {
        role: "user",
        content: `作品情報:\nタイトル: ${s.title}\n一言: ${s.logline}\n世界観: ${s.worldSetting.slice(0, 2000)}\n元の妄想: ${s.aiDraftInput ?? ""}\n${hint ? `要望: ${hint}` : ""}`,
      },
    ]);
    return Response.json({ text: text.trim() });
  } catch (e) {
    return errorResponse(e);
  }
}
