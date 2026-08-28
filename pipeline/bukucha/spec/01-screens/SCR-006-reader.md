# SCR-006: Reader
- route: /play/[routeId] | /play/guest
- auth: authenticated(guest は非永続)
- purpose: 本体験。他のすべての画面はここに人を連れてくるために存在する。

## Layout
```
 ←        story title        ⋯
 ◆ Trust 25 · Thawing   ▲ Nerve 15      ← Stat HUD
 ────────────────────────────────────
        OPENING
   (intro prose)

   (AI prose, streaming)
   ◆ Trust +5 — you stayed when it
     would have been easier to go
                    ┌ your line ┐
   (AI prose)
   [ Take his hand ]
   [ Look away and leave ]
   Say something else
 ────────────────────────────────────
 [ Say something, or *do something* ] [▶]
```
デスクトップ(≥900px)では2ペイン。右レールに Stat と Canon が常駐する。

## Components
| Component | Behavior | Data |
|---|---|---|
| Stat HUD | 常時。タップで SCR-021 | GET /api/routes/{id} `statView` |
| novel stream | SSE で逐次描画。`*〜*` は `<em>` | POST .../messages |
| stat delta line | 本文の直下に理由付きで一行 | SSE `stats` |
| choice card | 偶数ターン。消費で消える | SSE `done.choices` |
| Rewrite / Go back | 短押し=再生成、長押し=方向指定 | .../reroll, .../rewind |
| Continue | 空欄送信。**発言を増やさず続きだけ出す** | — |
| ending radar | 近い未到達エンディングのヒントを1行 | SSE `radar` |
| ending card | 成立時。エピローグ + コレクション導線 | SSE `ending` |
| tier notice | Cinematic 枠切れ。**止めずに落とす** | SSE `tier` |
| intermission | AI開示・休憩(SCR-025) | SSE `intermission` |
| crisis card | 生成を置き換える(SCR-025) | SSE `crisis` |
| menu | Canon / Play Guide / Story page / Endings / 新ルート | — |

## States
- loading: 「Loading…」
- generating: キャレット付きの逐次表示
- blocked: `blocked-card` + **入力を復元**
- quota: `quota-card`(**金額を書かない**)
- error: 再試行ボタン
- ended: 入力欄を無効化し、ending card を残す
- guest: 3往復で `guest-gate`

## Interactions
- 送信 / 空欄送信 / 選択肢 → 1ターン
- 長押し Rewrite → 方向指定モーダル
- Go back → 戻り先タップ → 巻き戻し(**AI抽出の Canon も同時に無効化**)
- ← → guest は SCR-005、認証済は SCR-007

## AI Behaviors
- AIF-002 本編生成(STANDARD 既定 / CINEMATIC 要求時)
- AIF-001 Canon 抽出、AIF-003 Stat 変動(**同一の呼び出しに相乗り、読者に非課金**)
- AIF-004 Ending 判定 + Radar(LLM を使わない)
- AIF-010 危機検出・AI開示
