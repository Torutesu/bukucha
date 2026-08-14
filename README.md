# Bukucha

**「妄想を具現化する、書けるラノベ・プラットフォーム」** — 女性向けノベル型AIチャット。

自分の欲望どおりのシチュエーションを一文から立ち上げ、AIとの共作で無限に続く一人称ラノベとして読む。書き手はシチュエーションを公開して読者と承認を得る(Pixiv型の両面市場)。

## リポジトリ構成

```
app/                    # プロダクト本体(Next.js + PostgreSQL + Prisma)
pipeline/bukucha/       # Clone Factory の成果物
├── teardown.md         # ベンチマーク分解(キャラぷ/Zeta/DMM他)
├── decisions.md        # 事業判断の記録
├── nsfw-analysis.md    # NSFW方針のメリデメ分析
├── build-notes.md      # 実装の逸脱・改善案(Stage 3)
├── spec/               # 実装スペック(PRD/画面/スキーマ/API/E2E/AI機能)
├── research/           # 一次調査の生データ
└── variants/           # 派生プロダクト計画(Web専業R18)
```

## 方針(確定済み)

- **完全女性向け**(夢小説・乙女ゲーム・TL/BL文化圏)
- **二次創作は禁止**(オリジナルのみ。公開前にIP検出でブロック)
- **シチュエーションが第一級**、キャラはその子(単体キャラという概念を持たない)
- **SPファースト**。Web + iOS/Android。PCでも中央480pxのSPビュー
- **NSFWは段階戦略**: Phase 1 = 寸止め(R15)+年齢確認 → Phase 2 = Web版のみR18
- LLMは外部APIの超低価格モデル(抽象化レイヤ経由で差し替え可能)

## セットアップ

```bash
cd app
npm install
npx prisma migrate dev     # PostgreSQL が必要
npm run db:seed            # タグ + シチュエーション21本
npm run dev                # http://localhost:3000
```

`.env` の設定は `pipeline/bukucha/build-notes.md` を参照。

## デプロイ(Vercel)

Vercelへのインポートだけで動く構成にしてある(`app/vercel.json` がビルド時に
`prisma migrate deploy → seed(冪等) → next build` を実行)。

1. [vercel.com/new](https://vercel.com/new) でこのリポジトリをインポート
2. **Root Directory を `app` に設定**(Framework: Next.js 自動検出)
3. Storage タブから **Neon (Postgres)** を接続(`DATABASE_URL` が自動注入される)
   ※他のPostgresを使う場合は `DATABASE_URL` を手動で設定
4. Environment Variables に以下を設定して Deploy:

| 変数 | 値 | 備考 |
|---|---|---|
| `AUTH_SECRET` | ランダムな長い文字列 | セッション署名 |
| `AUTH_DEV_MODE` | `true` | メール即ログイン(デモ用。誰でも任意のメールでログイン可) |
| `LLM_PROVIDER` | `mock` | デモは決定的応答。実LLMは `openai` + `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL_LIGHT`/`LLM_MODEL_MID` |

デモ公開の注意: `AUTH_DEV_MODE=true` は認証なし相当。限定共有に留め、
本公開前にmagic link実装(`api/auth/login` のTODO)とレート制限強化が必要。

## テスト

```bash
cd app
npm run test:e2e           # Playwright(LLMはモック) — 40件
```

## 状態

MVP実装済み(13画面 / E2E 40件全通過 / build・型・lintクリーン)。
2026-08-07: Zeta詳細インタラクションを追補 — 返信候補(50回/日)、AI応答の直接編集、
ここから分岐+並行ルート、選択肢ON/OFF、高品質モデル切替、組版・スクロール追従の強化
(`pipeline/bukucha/decisions.md` の同日エントリ参照)。
課金・通知・R18はスコープ外(`spec/00-prd.md` の out_of_scope 参照)。

### 運営管理(/admin)

role=ADMIN のユーザーのみアクセス可(SP: 上部タブ / PC: サイドバー付きワイド表示)。
操作はすべて `app/src/server/admin.ts` に集約し、`/api/admin/*` として露出。
全操作は AuditLog に記録される。

- 通報キュー: OPEN通報の一覧と resolve / dismiss
- 審査フラグ: 公開ブロック(IP検出・禁止表現・表現水準)の誤検出承認 / 確定。全承認後は作品管理から強制公開
- 作品: 検索、停止 / 復帰、強制公開、contentLevel修正
- ユーザー: 検索、BAN(公開作品も同時停止・ログイン拒否) / 解除、クリエイターバッジ、ADMIN付与
- 監査ログ: 操作の全履歴

### 運営MCPサーバー(app/mcp/admin-mcp.ts)

同じ `server/admin.ts` をMCPツール10個として露出。Claudeに「未対応の通報を確認して対応して」
のような運営オペレーションを任せられる。実行者は `ADMIN_EMAIL`(role=ADMIN必須)で、
操作は/admin画面と同じく全て AuditLog にそのユーザー名義で記録される。

```jsonc
// .mcp.json (Claude Code) の例
{
  "mcpServers": {
    "bukucha-admin": {
      "command": "npm",
      "args": ["run", "-s", "mcp:admin"],
      "cwd": "app",
      "env": {
        "DATABASE_URL": "postgresql://bukucha:bukucha@localhost:5432/bukucha",
        "ADMIN_EMAIL": "seed-author@bukucha.local"
      }
    }
  }
}
```

ツール: `admin_overview` / `admin_list_reports` / `admin_resolve_report` / `admin_list_flags` /
`admin_review_flag` / `admin_list_situations` / `admin_situation_action` / `admin_list_users` /
`admin_user_action` / `admin_list_audit_logs`
