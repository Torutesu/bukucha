# SCR-025: Intermission and crisis
- route: /play/[routeId] 内のオーバーレイ
- auth: any
- purpose: 法が求める開示を、没入を壊さない形で果たす。そして本当に必要なときは物語を止める。

## Layout
```
 ─ Intermission ─
        INTERMISSION
 You have been reading for a while.
 Everything in this story is written by an AI.
 <title> is fiction, and so is everyone in it.
 Stretch, drink something, and come back when
 you want to.
        [ Back to the story ]
        Stop here for now

 ─ Crisis ─
 Before the story goes on
 It sounds like you might be going through
 something painful right now. You deserve to
 talk to a person about it, not a narrator.
  · 988 Suicide & Crisis Lifeline — call or text 988
  · Crisis Text Line — text HOME to 741741
        [ Close ]
```

## Components
| Component | Behavior | Data |
|---|---|---|
| intermission | 成人は3時間ごと、未成年は1時間ごと | SSE `intermission` / `Route.lastDisclosureAt` |
| crisis card | **生成を置き換える。モデルを呼ばない** | SSE `crisis` / `CRISIS_RESOURCES` |
| stop link | ライブラリへ抜ける | — |

## States
- intermission: 物語は失われない。閉じれば同じ場所に戻る
- crisis: 入力は復元される。**物語には何も書き込まれない**

## Interactions
- 「Back to the story」→ 閉じる / 「Stop here for now」→ SCR-007

## AI Behaviors
- AIF-010。危機検出は意図的に**狭い**。悲嘆を描く物語は危機ではなく、
  誤検出はインタースティシャルを無視させる訓練になってしまう

## 法的根拠(`../../research/na-market.md` §3)
- **NY GBL 第47条**(2025-11-05 発効): AIであることの開示 / **3時間ごとの中断リマインダー** /
  自傷・自殺念慮の検出と危機介入。州司法長官が執行、**1日最大 $15,000**
- **CA SB 243**(2026-01-01 発効): 開示 / **未成年への休憩リマインダー** / 危機対応。
  **私人訴権あり、1違反 $1,000 + 弁護士費用**。2027-07-01 から年次報告

両法とも違反ごとの制裁なので、`SafetyEvent` に**実行の証跡を残す**(02-schema #8)。
「やったつもり」は通用しない。

そしてこれは義務であると同時に**競争優位**でもある。ストアから消えないプラットフォームは、
クリエイターにとって「作品を置ける場所」として選ばれる。
