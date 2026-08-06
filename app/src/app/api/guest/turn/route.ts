import { errorResponse } from "@/lib/auth";
import { assertGuestQuota } from "@/lib/ratelimit";
import { guestTurn } from "@/server/stories";
import { sseResponse } from "@/server/sse";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    assertGuestQuota(ip);
    const b = await req.json();
    return sseResponse(() =>
      guestTurn(
        String(b.situationId),
        String(b.introVariantId),
        Array.isArray(b.history) ? b.history : [],
        String(b.content ?? "")
      )
    );
  } catch (e) {
    return errorResponse(e);
  }
}
