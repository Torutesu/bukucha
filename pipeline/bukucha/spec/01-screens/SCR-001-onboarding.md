# SCR-001: Onboarding
- route: /welcome
- auth: public
- purpose: 何が好きかを1画面で受け取り、登録の前に作品まで連れていく。

## Layout
```
        HEADCANON
   Your headcanon, playable
 ─────────────────────────────
 What are you here for?
 Pick as many as you like.
 [slow burn][enemies to lovers]
 [found family][isekai] ...
 ─────────────────────────────
      [ Show me something ]
```
Step1 = トロープ選択、Step2 = おすすめ3件のグリッド。

## Components
| Component | Behavior | Data |
|---|---|---|
| tag chips | 複数選択。選択状態は `data-on` | GET /api/tags?category=trope |
| primary CTA | 1件以上でのみ活性。localStorage に嗜好と訪問済みを記録 | — |
| recommend grid | 3件。一致が足りなければ人気で埋め、見出しを変える | GET /api/home/recommend |
| skip link | 「Browse everything instead」でホームへ | — |

## States
- loading: チップ / カードのスケルトン
- empty: 一致0件 → 見出しを "What people are playing" にして人気を出す(`fallback:true`)
- error: 再試行ボタン
- success: カードから SCR-005 へ

## Interactions
- チップ選択 → CTA活性
- CTA → Step2(嗜好は localStorage、登録時に PATCH /api/me で移送)
- カード → SCR-005
- skip → SCR-002

## AI Behaviors
none(推薦はタグ一致 + 人気のフォールバック。初回に賢さは要らない)

## ベンチマークとの差
OOC は登録を先に要求する。ここは**登録前に作品まで、さらに数ターンのプレイまで**行ける([USER-REQ] FLOW-1)。
