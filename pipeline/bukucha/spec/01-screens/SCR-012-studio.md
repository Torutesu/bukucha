# SCR-012: Studio
- route: /studio
- auth: authenticated
- purpose: 書いた人に、伸びていることを見せる。承認がクリエイター供給の燃料。

## Layout
```
 Studio                       + New story
 ┌ Players this week   Likes this week ┐
 │        128  ▲12          31  ▲4     │
 └─────────────────────────────────────┘
 [Published][Draft][Link only][Private]
 ┌ He Is Only Honest When It Rains ────┐
 │ ◍ 240   ♥ 193   ★ 41 endings found  │
 │                   Edit    Stats ▾   │
 │   ▁▂▅▇▆▃▁  (daily players)          │
 └─────────────────────────────────────┘
```

## Components
| Component | Behavior | Data |
|---|---|---|
| weekly summary | 前週比のデルタ付き | GET /api/studio/summary |
| status tabs | Published / Draft / Link only / Private | GET /api/studio/stories |
| work card | プレイ数・いいね・**エンディング到達数** | — |
| mini chart | 日次プレイ数 | .../stats |

## States
- empty: 「You have not written anything yet.」+ 「Give us one line and we will build the whole thing」
- loading / error

## Interactions
- Edit → SCR-009 / New story → SCR-009 Step0

## AI Behaviors
none

## ベンチマークとの差(最大の攻撃点のひとつ)
OOC の Certified Creator は **累計1,000人と会話 + 公開10本 + フォロワー500人**を満たして初めて
**10万インタラクション**のミッションに挑戦でき、通っても OOC Original は **$300 + レベニュー2%と引き換えに
著作権を恒久譲渡**させる(`../../research/ooc.md` §7)。
ここでは**門を置かない**。1作目の1ターン目から数字が動き、収益が積まれ、**著作権は作者に残る**(非独占ライセンス)。
AO3 / Wattpad / Patreon の文化圏から作家を連れてくるには、これ以外の条件はありえない。
