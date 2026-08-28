# HEADCANON

**Your headcanon, playable — and it never forgets.**

Interactive anime for North America. You are the protagonist, the story has stats and
endings, and what you told it in chapter one is still true in chapter twenty.

`headcanon` is the fandom word for the version of a story that is yours and not official.
It is also the counter-concept to our benchmark's own name — **OOC**, *out of character* —
drawn from the same vocabulary the audience already speaks.

## なぜこれを作るのか

ベンチマークは **OOC: The Playable Anime**(ooc.ai / Wrtn Technologies)。
韓国 Crack・日本 キャラぷ と同一エンジンの北米版で、ローンチ4ヶ月で
**米国 Google Play の Simulation 売上6位**に入っている。市場は実在する。

そして否定レビュー61件の内訳が異常に偏っている:

| 不満 | 比率 |
|---|---|
| クレジットが高い + 無料枠が少ない + 攻撃的な収益化 | **約 69%** |
| **AI が記憶を失う**(しかも教え直すのにまた課金される) | **23%** |

文章品質・世界観・UI への不満はほぼない。
**同じものを作って、この2点だけを正しく設計すれば勝てる市場**である。

詳細: [`pipeline/bukucha/teardown.md`](pipeline/bukucha/teardown.md)

## どう超えるか

| | OOC | HEADCANON |
|---|---|---|
| **記憶** | Keyword Note **同時3件** + 要約。"Deep Memory" と宣伝しつつ忘れる。直すのに課金 | **Canon Ledger** — 構造化・無制限・永続・ユーザー編集可。**編集は永久に無料** |
| **課金** | クレジット従量のみ。**サブスクなし**。最上位1通 ≒ $0.28、無料枠は1日1〜3通 | **Standard は全プラン無制限**。Cinematic だけ枠制、切れたら**止めずに落とす**。$9.99(Web $7.99) |
| **クリエイター** | 1,000人 × 500フォロワー × 公開10本 × 10万インタラクションで応募資格。通れば **$300 + 2% と引き換えに著作権を恒久譲渡** | **門なし。1ターン目から収益。非独占ライセンスで著作権は作者のもの** |
| **エンディング** | N/R/SR/SSR とコレクション。ただし条件は不可視で運に見える | 同じ構造 + **Ending Radar** で距離が見える。狙って取れる |
| **発見** | SPA。作品ページが検索エンジンに存在しない | **SSR + OGP + JSON-LD**。未ログイン・JS無効で読める |
| **規制** | App Store **13+** のまま Adult 層を持つ | ストアは 13+ に固定。**AI開示・休憩・危機介入を最初から実装**(NY法/CA法) |

## リポジトリ構成

```
app/                         プロダクト本体(Next.js + PostgreSQL + Prisma)
pipeline/bukucha/            Clone Factory の成果物
├── teardown.md              OOC 分解 + 北米向け設計判断(Stage 1)
├── decisions.md             事業判断の記録(2026-08-28 の方針転換を含む)
├── user-requirements.md     ユーザー要件の原文
├── build-notes.md           実装の逸脱・E2Eが見つけた実バグ・未実装(Stage 3)
├── spec/                    実装スペック(Stage 2)
│   ├── 00-prd.md            19画面 / 成功条件 / 検証仮説
│   ├── 01-screens/          19画面(1画面1ファイル)
│   ├── 02-schema.md         schema.prisma の写し + 不変条件
│   ├── 03-api.md            エンドポイントと SSE イベント契約
│   ├── 04-e2e-cases.md      E2E 27件(P0 23)
│   └── 05-ai-features.md    AIF-001〜010(全件 fallback 定義済み)
├── research/
│   ├── ooc.md               ★ OOC 一次データ(APIルート全列挙 / Builder 機構 / 価格 / レビュー統計)
│   ├── na-market.md         ★ 北米の需要・競合・規制(NY GBL 47 / CA SB 243 / Apple)
│   ├── kyarapu.md           OOC の日本版。同一エンジンなので引き続き有効
│   └── (zeta / dmm / nsfw-female-market)  日本市場の資料として保存
└── variants/                日本市場向けの派生計画(凍結)
```

## セットアップ

```bash
cd app
npm install
export DATABASE_URL="postgresql://headcanon:headcanon@localhost:5432/headcanon_dev"
npx prisma db push && npx prisma generate
npm run db:seed          # タグ40 + 英語作品22本(旗艦作品は stats/endings/keywords 込み)
npm run dev              # http://localhost:3000
```

env の詳細は [`pipeline/bukucha/build-notes.md`](pipeline/bukucha/build-notes.md)。

## テスト

```bash
cd app
npm run test:e2e         # Playwright / LLM はモック / 27件
```

## 状態

MVP 実装済み。**19画面 / E2E 27件全通過 / build・型・lint クリーン。**

未実装: 決済の接続、OAuth、クリエイター送金、Route Map の UI、通知、シーン画像、ネイティブ申請。
**そして最大の宿題は「1ターンあたり LLM 原価の実測」** — `Free = Standard 無制限` はこれなしに外部公約できない。
