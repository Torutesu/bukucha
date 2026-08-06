import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

/** 画像アップロード(SCR-009/010/014)。MVPはローカル保存 [build-notes: 本番はオブジェクトストレージ] */
export async function POST(req: Request) {
  try {
    await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(422, "file_required");
    if (file.size > 5 * 1024 * 1024) throw new HttpError(422, "too_large", "5MB以下にしてください");
    const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[
      file.type
    ];
    if (!ext) throw new HttpError(422, "invalid_type", "jpg/png/webpのみ対応です");
    const name = `${crypto.randomBytes(12).toString("hex")}${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    return Response.json({ url: `/uploads/${name}` });
  } catch (e) {
    return errorResponse(e);
  }
}
