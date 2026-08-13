/**
 * クライアント側エラーの収集(実機トラブルの一次情報)。
 * Vercelランタイムログで `[client]` を検索すると見える。
 */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    console.error(
      "[client]",
      JSON.stringify({
        type: String(b.type ?? "").slice(0, 40),
        message: String(b.message ?? "").slice(0, 500),
        url: String(b.url ?? "").slice(0, 200),
        ua: req.headers.get("user-agent")?.slice(0, 160) ?? "",
      })
    );
  } catch {
    /* noop */
  }
  return Response.json({ ok: true });
}
