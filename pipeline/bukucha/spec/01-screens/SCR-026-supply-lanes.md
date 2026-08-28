# SCR-026: Supply lanes (builder entry points)
- route: /create (Step 0)
- auth: authenticated
- purpose: ローンチ在庫を3つの経路で作る。「一文から」だけでは棚が埋まらない。

## Layout
```
 [From one line][From something written][From a card]

 ─ From one line ────────────────────────────
   One line. That is all we need.
   [ e.g. The duke who bought my family's… ]
   [ Draft it for me ]   Start blank

 ─ From something written ───────────────────
   Paste what already exists.
   A chapter is enough. We find the structure
   that is already in it.
   [ ...prose... ]
   [x] This is someone else's work, licensed to us
       [ Source title ]
       [ Rights holder (legal name) ]
       Non-exclusive. The rights holder keeps their
       copyright and can publish the original
       anywhere else, at any time.
   [ Make it playable ]

 ─ From a card ──────────────────────────────
   Bring your card over.
   ┌ Imported cards stay private. ───────────┐
   │ Only you can see or play them.          │
   └─────────────────────────────────────────┘
   [ choose a .png ]
```

## Components
| Component | Behavior | Data |
|---|---|---|
| lane picker | premise / adapt / import | — |
| prose input | 400字以上。最大24,000字をモデルに渡す | POST /api/stories/adapt |
| licensed toggle | ONなら **rightsHolder が必須**(422 で弾く) | — |
| card file input | PNG のみ、8MBまで | POST /api/stories/import-card |
| import notice | 「取り込んだカードは非公開のまま」を**入れる前に**言う | — |

## States
- drafting: 「Building the world…」
- import error: 「That PNG has no character card in it. Export it from SillyTavern or Chub…」
  — **どこから持ってくればいいかを書く**。「不正なファイル」では直せない
- 成功: いずれも Step1(編集)に着地。以降は通常のビルダー

## Interactions
- adapt / import 成功 → Step1
- 取り込んだ作品を公開しようとする → **403 `import_is_private`**(サーバー側で拒否)

## AI Behaviors
- **AIF-005**(一文 → 作品)
- **AIF-015**(既存の散文 → 遊べる作品)。名前・声・トーンは原文のまま。
  stat は「その物語が実際に何を賭けているか」を追う。恋愛でないなら affinity を作らない
- import は AI を使わない(決定的なパース)

## 3レーンの役割(`../../research/na-supply.md` §5)
| レーン | 役割 | 理由 |
|---|---|---|
| From one line | 通常のUGC | 読者が育ってから効く |
| **From something written** | **カタログ本体** | Royal Road だけで5万本。作家は囲われておらず、読者も付いてくる |
| **From a card** | **移住ツール(獲得)** | Character.AI 1,800万体 + Janitor AI 1,500万ユーザー。ただし大半が二次創作なので**公開はさせない** |
