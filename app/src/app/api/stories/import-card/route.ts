import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { importCharacterCard } from "@/server/import-card";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Character Card V2/V3 import. The result is always private — see
 * `publishStory`, which refuses to publish an IMPORTED story.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(422, "no_file", "Choose a card PNG to import.");
    if (file.size > MAX_BYTES)
      throw new HttpError(422, "too_large", "Character cards should be under 8MB.");
    const buf = Buffer.from(await file.arrayBuffer());
    const story = await importCharacterCard(user, buf, file.name);
    return Response.json(story);
  } catch (e) {
    return errorResponse(e);
  }
}
