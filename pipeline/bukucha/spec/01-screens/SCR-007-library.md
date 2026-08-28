# SCR-007: Library
- route: /library
- auth: authenticated
- purpose: 中断した物語に戻る摩擦をゼロにする。

## Layout
```
 Library
 [Playing][Finished]
 ┌──────────────────────────────┐
 │[cover] He Is Only Honest...  │
 │        4 scenes · 2h ago     │
 │        Previously — you found│
 │        the thing he did not… │
 │                    Continue  │
 └──────────────────────────────┘
```

## Components
| Component | Behavior | Data |
|---|---|---|
| tabs | Playing(`ACTIVE`)/ Finished(`ENDED`) | GET /api/routes?status= |
| route card | 表紙 + 進捗 + **"Previously —" の自動あらすじ** | — |
| recap refresh | 古い(`lastRecapAtIdx < latest-1`)なら背後で更新 | POST .../recap |
| ⋯ menu | 完結にする / 作品ページ / 削除(確認あり) | PATCH, DELETE |

## States
- loading: カード3枚のスケルトン
- empty: Playing なら「Nothing in progress yet.」/ Finished なら「You have not finished a route yet.」+ 「Find a story」
- error: 「We could not load your library.」

## Interactions
- Continue / カード → SCR-006 / 作品ページ → SCR-005

## AI Behaviors
- AIF-006「Previously on…」。**失敗しても直近本文の冒頭を出す**。カードは常に何かを語る

## ベンチマークとの差
OOC はトーク一覧。ここは**本棚 + 前巻のあらすじ**として設計する。中断が長いほど効く。
