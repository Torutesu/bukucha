# SCR-002: Discover (Home)
- route: /
- auth: public
- purpose: 今日読むものを最短で決めさせる。

## Layout
```
 HEADCANON                    ◍
 YOUR HEADCANON, PLAYABLE
 [ Search stories, tropes, creators ]
 (trope chips ─ horizontal)
 [ Safe mode is on. Mature hidden. ]   ← 未確認時のみ
 ── For you ────────────────  → → →
 ── Being played right now ──  → → →
 ── New this week ───────────  → → →
 [Discover][Library][Create][You]
```

## Components
| Component | Behavior | Data |
|---|---|---|
| brand lockup | 名前 + タグライン。カテゴリの主張を毎回見せる | brand.config |
| search entry | タップで SCR-003 | — |
| trope chips | タップで SCR-003(タグ絞り込み済み) | GET /api/tags?category=trope |
| safe-mode banner | 未成年 / 未確認のときだけ。SCR-018 へ | GET /api/me |
| section rows | 横スクロールのカード列 | GET /api/home |

## States
- 未訪問かつ未ログイン → `/welcome` にリダイレクト
- loading: セクション3つ分のスケルトン
- empty: セクションごとに "Nothing here yet."
- error: 「We could not load the shelf.」+ 再試行

## Interactions
- カード → SCR-005 / チップ → SCR-003 / ◍ → SCR-014

## AI Behaviors
none(推薦はサーバー側の集計)

## ベンチマークとの差
OOC は推薦が4系統(新規/類似/行動/出席連動)。MVP は3系統に絞り、**タグ導線を一等地に置く**。
北米の需要は固有名詞・トロープ検索に寄っている(`../../research/na-market.md` §1)。
