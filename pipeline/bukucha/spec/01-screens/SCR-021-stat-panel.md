# SCR-021: Stat panel
- route: /play/[routeId] 内(HUD + シート / デスクトップは右レール常駐)
- auth: authenticated
- purpose: 物語の現在地を数値で見せ、次の行動の目標にさせる。

## Layout
```
 HUD (header)   ◆ Trust 25 · Thawing   ▲ Nerve 15
 Sheet
   Where this route stands
   ◆ Trust  Thawing                25
   ▬▬▬▬▬▬▬░░░░░░░░░░░░
   ▲ Nerve  Hesitant               15
   ▬▬▬▬░░░░░░░░░░░░░░░
```

## Components
| Component | Behavior | Data |
|---|---|---|
| HUD | 常時表示。タップでシート | `statView[]` |
| level name | 現在のレベル帯(`GTE`/`LT` で判定) | StatLevel |
| bar | `(value-min)/(max-min)` | — |
| delta line | 本文直下に **`◆ Trust +5 — you stayed…`** | SSE `stats` / StatDelta |

## States
- stats が0件の作品では HUD ごと出さない
- 抽出失敗のターンは数値が動かない(物語は進む)

## Interactions
- HUD タップ → シート / デスクトップは常駐

## AI Behaviors
- AIF-003。増減条件は作者が自然文で書き(`StatDef.changeRule`)、
  レベル帯の `prompt` が**キャラの口調そのものを変える**

## ベンチマークとの差
OOC は 1 start setting あたり **最大7個、レベル最大4段、値域 ±99,999**、
「stat が変わると AI の口調と振る舞いが変わる」という同じ発明を持つ(`../../research/ooc.md` §4)。
ここは構造を踏襲したうえで、**なぜ動いたのかを一行で見せる**。
理由が見えない数値は演出だが、理由が見える数値はゲームループになる。
