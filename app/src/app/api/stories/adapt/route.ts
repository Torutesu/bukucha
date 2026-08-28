import { requireUser, errorResponse } from "@/lib/auth";
import { createDraftFromProse } from "@/server/stories";

/**
 * AIF-015. Two callers, one pipeline: editorial turning its own drafts into
 * launch stock, and a licensed adaptation of a work that already exists.
 * `licensed: true` is what makes it the second, and it demands a rights holder.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const b = await req.json();
    return Response.json(
      await createDraftFromProse(user, String(b.prose ?? ""), {
        sourceTitle: b.sourceTitle ? String(b.sourceTitle) : undefined,
        sourceUrl: b.sourceUrl ? String(b.sourceUrl) : undefined,
        rightsHolder: b.rightsHolder ? String(b.rightsHolder) : undefined,
        author: b.author ? String(b.author) : undefined,
        licensed: Boolean(b.licensed),
        revenueShareBps: Number.isFinite(b.revenueShareBps)
          ? Number(b.revenueShareBps)
          : undefined,
        termEndsAt: b.termEndsAt ? String(b.termEndsAt) : undefined,
      })
    );
  } catch (e) {
    return errorResponse(e);
  }
}
