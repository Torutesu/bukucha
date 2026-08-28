# SCR-009: Story Builder
- route: /create
- auth: authenticated
- purpose: 一文の思いつきを、その場で遊べる作品にする。

## Layout
```
 Step 0  One line. That is all we need.
         [ e.g. The duke who bought my family's debt… ]
         [ Draft it for me ]   [ Start blank ]

 Steps   Premise > World > Cast > Openings > Test play > Publish
         (data-step on #step-indicator)
```

## Components
| Component | Behavior | Data |
|---|---|---|
| premise input | 10〜400字 | POST /api/stories/draft |
| drafting state | 「Building the world…」+ world → cast → openings → stats → endings | — |
| field + rewrite | 各欄に「Rewrite this for me」 | POST .../rewrite-field |
| character list | タップで SCR-010 / 最大3 | .../characters |
| intro editor | Name(25字)/ 導入 / 冒頭 / Play Guide。最大3 | .../intros |
| test play | 非永続。本番と同じパイプライン | POST .../test-turn |
| tag select | 最大6 | GET /api/tags |
| rating radio | All ages / 18+ | — |
| publish | 公開 / Link only / Private | POST .../publish |

## States
- drafting: 進行表示。失敗時は「That did not come together.」+ 白紙導線
- moderation blocked(`moderation-error`): **検出語を具体的に出す**。直せる情報がなければ直せない
- published: 「It is live.」+ 作品ページ / 共有

## Interactions
- Draft it for me → AIF-005 → Step1 に全項目が埋まった状態で着地
- Next / Back → ステップ移動(**移動前に保存中のリクエストを必ず完了させる**)
- Publish → AIF-009 → 成功なら SCR-005

## AI Behaviors
- **AIF-005**: 一文 → 世界・キャラ・Intro2件・Stat(レベル付き)・Ending4件(N/R/SR/SSR)・Keyword・タグ
- AIF-007 欄単位の書き直し / AIF-008 会話例 / AIF-009 公開前チェック

## ベンチマークとの差
OOC の Story Builder は **8段階**(Profile / Basic / Intro / Stat / Media / Keyword Book / Endings / Publish)で、
項目ごとに9本のAI支援エンドポイントを持つ。**段階数そのものが完遂率の敵**なので、
ここは「先に丸ごと生成 → 編集」に反転させる。生成される構造は同等以上であること(E2E-027 で検証)。
