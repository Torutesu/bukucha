# SCR-005: Story page
- route: /story/[slug]
- auth: public(**サーバーコンポーネント**)
- purpose: 始める前に期待を作る。そして検索エンジンから直接ここに着地させる。

## Layout
```
 ←                        ♥ 193   ⋯
        [ cover 3:4 ]
 He Is Only Honest When It Rains
 One shared umbrella, and neither of you says the thing.
 by HEADCANON Editorial · ◍ 240 players · 388 routes
 [18+]? [slow burn][academy][touch starved]
 ┌ Endings ────────── 1 of 4 found ┐
 │ ●○○○   rarer endings need       │
 │        different choices        │
 └─────────────────────────────────┘
 The world / Who you will meet / What this route tracks / How it opens
 ────────────────────────────────────
 (fixed) Continue where you left off
         ( ) The studio after hours
         ( ) The walk home, raining
         [ Start this story ]
```

## Components
| Component | Behavior | Data |
|---|---|---|
| SSR body | タイトル・ログライン・世界観・キャラ・冒頭を**サーバーで**描く | storyDetail() |
| metadata | `<title>` / `og:*` / `twitter:*` / `JSON-LD (CreativeWork)` | generateMetadata |
| `<noscript>` | 本文と sign-in リンクの最小版 | — |
| ending progress | 到達=塗り、未到達=枠のみ。**未到達の名前は出さない** | endingsFound |
| stat preview | このルートが何を追うか(名前とアイコンだけ) | intro.stats |
| intro radio | 2件以上のときだけ表示 | — |
| CTA | 未ログイン: 「Play a few turns — no account needed」 | — |
| like / report | ハイドレーション完了まで `disabled` | — |

## States
- loading: サーバー描画なのでスケルトンなし
- not found / not visible: `notFound()`
- **pre-hydration**: 対話要素は無効。**見えるのに何も起きないボタンを出さない**

## Interactions
- Start(ログイン済) → POST /api/routes → SCR-006
- Start(未ログイン) → localStorage にゲストルート → `/play/guest`
- Endings カード → SCR-022 / タグ → SCR-003 / ⋯ → 通報

## AI Behaviors
none

## ベンチマークとの差
**OOC の作品ページは SPA の中にしか存在しない。**この市場で人はアプリではなく「話したい相手」を検索する
(`../../research/na-market.md` §1)。ここを SSR + OGP + JSON-LD で開けていることが最大の獲得チャネル。
