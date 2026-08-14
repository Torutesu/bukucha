export const maxDuration = 300;

/**
 * カバーアート生成の一時エンドポイント(シード用アセット制作にのみ使用)。
 * COVER_TASK_SECRET が未設定なら常に403。制作完了後にルートごと削除する。
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!process.env.COVER_TASK_SECRET || b.secret !== process.env.COVER_TASK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const key = process.env.LLM_API_KEY;
  if (!key) return Response.json({ error: "no_api_key" }, { status: 500 });

  const tryModel = async (model: string, size: string) => {
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: String(b.prompt ?? "").slice(0, 2000),
        size,
        n: 1,
        quality: model === "dall-e-3" ? "standard" : "medium",
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`${model}: ${JSON.stringify(j.error ?? j).slice(0, 300)}`);
    const item = j.data[0];
    if (item.b64_json) return item.b64_json as string;
    // dall-e-3はURL返却のことがある: サーバー側で取得してb64化
    const img = await fetch(item.url);
    return Buffer.from(await img.arrayBuffer()).toString("base64");
  };

  try {
    let b64: string;
    let firstErr = "";
    try {
      b64 = await tryModel("gpt-image-1", "1024x1536");
    } catch (e1) {
      firstErr = String(e1);
      try {
        b64 = await tryModel("dall-e-3", "1024x1792");
      } catch (e2) {
        return Response.json({ error: `${firstErr} | ${String(e2)}`.slice(0, 600) }, { status: 502 });
      }
    }
    return Response.json({ b64 });
  } catch (e) {
    return Response.json({ error: String(e).slice(0, 400) }, { status: 502 });
  }
}
