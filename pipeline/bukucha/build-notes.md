# Build Notes (Stage 3 — HEADCANON / 北米版)

- date: 2026-08-28
- 対象: `app/`(v1 日本版からの全面改修)
- 状態: **build / tsc / eslint クリーン。E2E 27件 全通過(連続2回)**

## 実行環境の再現手順

```bash
# PostgreSQL 16
pg_ctlcluster 16 main start   # または pg_ctl -D /var/lib/postgresql/16/main -o '-c config_file=/etc/postgresql/16/main/postgresql.conf'
psql -c "CREATE ROLE headcanon LOGIN PASSWORD 'headcanon' SUPERUSER;"
psql -c "CREATE DATABASE headcanon_dev OWNER headcanon;"

cd app
npm install
export DATABASE_URL="postgresql://headcanon:headcanon@localhost:5432/headcanon_dev"
npx prisma db push && npx prisma generate
npm run db:seed
npm run dev

npm run test:e2e     # E2E 用 DB は global-setup が毎回作り直す
```

必要な env: `DATABASE_URL` / `AUTH_SECRET` / `AUTH_DEV_MODE`(開発のみ)/
`LLM_PROVIDER`(`mock` or 空)/ `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL_STANDARD` / `LLM_MODEL_CINEMATIC` /
`GENERATION_TIMEOUT_MS` / `MESSAGE_RATE_LIMIT` / `E2E_MODE`。

## スペックからの逸脱と、その理由

| # | 逸脱 | 理由 |
|---|---|---|
| 1 | `Situation` → `Story`、`Story` → `Route` の全面リネーム | ベンチマークと北米読者の語彙に合わせた。同時に URL を `/story/<slug>`(SEO)と `/play/<id>` に直した。これは命名の問題ではなく**獲得チャネルの問題**だった |
| 2 | SCR-005 をクライアントからサーバーコンポーネントに変更 | 未ログイン・JS無効で読めなければ検索流入の意味がない。対話部分だけ client island に分離 |
| 3 | SCR-015 を独立画面ではなく SCR-018 内のセクションに | MVP は決済を持たない。画面を割るより「無制限」を一文で言い切ることが重要 |
| 4 | `RouteMemory`(要約)を残したまま `CanonFact` を足した | 要約は物語の流れに、台帳は事実に効く。**片方だけでは足りない** |
| 5 | 状態抽出(Canon + Stat)を1回の LLM 呼び出しに統合 | 読者に課金しない以上、安いことが設計要件。2回呼ぶ実装は要件を満たさない |
| 6 | エンディング判定を完全に決定的にした(LLM を使わない) | 「到達したはずのエンディングが来ない」は許容できない。毎ターン走らせても無料 |
| 7 | ルールなしエンディングをフォールバック扱いにした | E2E で発覚。ルールなし + minTurns 10 だと**全ルートが10ターンで終わる**。ルールを持つ候補を常に優先し、ルールなしは最長ターンにする |
| 8 | SCR-005 の対話要素をハイドレーション完了まで `disabled` | E2E で発覚。SSR ページは「押せるのに何も起きない」状態を持つ。遅い回線では実害になる |
| 9 | PC 中央480px 固定をやめ、リーダーのみ2ペインに拡張 | v1 の [USER-REQ]。北米はデスクトップ比率が高く、SillyTavern 文化圏は PC が主戦場 |
| 10 | i18n の抽出はしていない(英語をコンポーネントに直接書いた) | 二言語同時運用はしない方針(`decisions.md` 判断E)。`brand.config.ts` の差し替えでブランドは切れる |

## E2E が見つけた実バグ(仕様書では見つからなかったもの)

1. **`Tag.isR15` の取り残し** — enum は `TEEN` に直したがフィールド名が残り、タグAPIが全滅していた。
   ホーム全体が真っ白になる。型では捕まらない(Prisma の where は構造型)
2. **全ルートが10ターンで終わる**(上記 #7)。ルールなしエンディングの設計欠陥
3. **SSR ページのハイドレーション前クリックが無音で落ちる**(上記 #8)
4. **Canon 反映のレース** — `onDone` で台帳を取り直していたが、台帳が書かれるのは done の**後**。
   ストリーム完了後に移した

いずれも「仕様どおり実装したのに壊れている」類で、**E2E がなければ気づけなかった**。

## 既知の制約 / 未実装

- **1ターンあたり LLM 原価が未実測**。`Free = Standard 無制限` はこの実測なしに外部公約してはいけない。
  当面は `lib/ratelimit.ts` の公正利用上限で守る
- 決済は未接続(プラン表示と枠管理のみ)。Stripe Checkout は P1
- OAuth(Google / Apple)は未接続。`oauthEnabled = false` で disabled 表示
- 画像アップロードはローカルディスク。本番はオブジェクトストレージ
- `CreatorEarning` はモデルのみ。集計ジョブと送金は未実装
- 危機検出は正規表現ベース。意図的に狭い。**本番投入前に臨床レビューを推奨**
- `IP_DICTIONARY` は代表例のみ。本番は保守された第三者リストに差し替える

## 検証コマンド

```bash
cd app
npx tsc --noEmit     # 0 errors
npx eslint .         # 0 problems
npm run build        # ✓ Compiled successfully
npm run test:e2e     # 27 passed
```
