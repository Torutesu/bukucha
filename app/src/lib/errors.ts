/**
 * HTTPエラー表現。Next.jsに依存しないモジュールとして分離
 * (server/admin.ts をMCPサーバー等のNext外ランタイムからもimportできるようにするため)。
 */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}
