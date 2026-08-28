# SCR-022: Endings collection
- route: /story/[slug]/endings
- auth: authenticated
- purpose: 「終わり」を集めさせ、同じ作品をもう一度遊ばせる。

## Layout
```
 ← He Is Only Honest When It Rains
   1 of 4 endings found
 The studio after hours
 ┌ COMMON ────────┐ ┌ RARE ──────────┐
 │ Not yet found  │ │ He says it     │
 │ Some things    │ │ first      ×2  │
 │ simply end…    │ │ (tap for       │
 └────────────────┘ │  epilogue)     │
 ┌ SUPER RARE ────┐ └────────────────┘
 │ Not yet found  │ ┌ LEGENDARY ─────┐
 │ Something is   │ │ Not yet found  │
 │ possible if you│ │ Something is   │
 │ stop waiting.  │ │ within reach…  │
 └────────────────┘ └────────────────┘
        [ Play another route ]
```

## Components
| Component | Behavior | Data |
|---|---|---|
| progress | 「N of M endings found」 | GET /api/stories/{id}/endings |
| ending card | 到達=名前 + タップでエピローグ。**未到達=ヒントのみ、名前も条件も出さない** | — |
| repeat count | 到達回数を `×N` で積む | EndingReached |
| rarity | N/R/SR/SSR を色で。`brand.rarity` から | brand.config |

## States
- 未到達のみ: すべてヒント表示。**それでも何が待っているかは伝わる**
- 401 → SCR-017

## Interactions
- カード → エピローグ展開 / CTA → SCR-005(別ルート)

## AI Behaviors
- AIF-004(判定は決定的。エピローグは作者が書くか AIF-005 が下書きする)

## ベンチマークとの差
OOC も N/R/SR/SSR とカードの積み上げ、上位5件のランキングバッジを持つ(`../../research/ooc.md` §4)。
**踏襲する。**違うのは、プレイ中に距離が見える(Ending Radar)ため、
レアエンディングが**運ではなく狙い**になること。
