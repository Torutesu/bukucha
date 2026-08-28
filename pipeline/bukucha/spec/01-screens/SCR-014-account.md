# SCR-014: Your account
- route: /me
- auth: authenticated
- purpose: 自分が誰として物語に入るかを決める場所。

## Layout
```
 (W)  Wren                        Edit
 Who you are in the story
  ┌ Wren  default ─────── Edit ┐
  │ called "you"               │
  └────────────────────────────┘
  + Add a persona
 Stories you liked        → → →
 More
  Settings and plan / Creator studio / Terms, privacy and content policy / Sign out
 [Discover][Library][Create][You]
```

## Components
| Component | Behavior | Data |
|---|---|---|
| display name | インライン編集 | PATCH /api/me |
| persona list | 名前 / 呼ばれ方 / 設定 / デフォルト | /api/me/personas |
| liked row | 横スクロール | GET /api/me/likes |
| links | 設定・スタジオ・法令・サインアウト | — |

## States
- loading: スケルトン / liked が0件ならセクションごと出さない

## Interactions
- persona 保存 → 以降の新規ルートに既定で適用
- Sign out → 確認 → `/`

## AI Behaviors
none
