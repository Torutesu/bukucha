import { requireUser, errorResponse } from "@/lib/auth";
import { createRoute, listRoutes } from "@/server/routes";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const b = await req.json();
    const route = await createRoute(
      user,
      String(b.storyId),
      String(b.introId),
      b.personaId ? String(b.personaId) : undefined
    );
    return Response.json(route);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const p = new URL(req.url).searchParams;
    const items = await listRoutes(
      user,
      p.get("status") === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
      p.get("storyId") ?? undefined
    );
    return Response.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}
