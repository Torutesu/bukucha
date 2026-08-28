# SCR-015: Plans and credits
- route: /settings 内のセクション(独立画面は P1)
- auth: authenticated
- purpose: 「核となる読書体験には料金メーターが付いていない」と一目で言い切る。

## Layout
```
 Plan
 ┌────────────────────────────────────────────┐
 │ You are on Free. Standard turns are        │
 │ unlimited.                                 │
 │ Cinematic: 3 of 3 left · resets 08/29/2026 │
 │ ┌ Free            Free ──────────────────┐ │
 │ │ Read forever. No meter on the story.   │ │
 │ │ · Unlimited turns on the Standard      │ │
 │ │ · 3 Cinematic turns a day              │ │
 │ │ · Canon memory, always free to edit    │ │
 │ │ · No ads, ever                         │ │
 │ ├ Reader   $9.99/mo · $7.99 on the web ──┤ │
 │ ├ Author  $19.99/mo · $15.99 on the web ─┤ │
 │ └────────────────────────────────────────┘ │
 │ Editing your Canon is free on every plan,  │
 │ forever.                                   │
 └────────────────────────────────────────────┘
```

## Components
| Component | Behavior | Data |
|---|---|---|
| current plan line | **最初の一文が「unlimited」であること** | GET /api/me `plan` |
| quota line | Cinematic の残数とリセット日 | `quota` |
| plan cards | 価格 / Web直販価格 / 特典 | `plans`(= `lib/quota.ts` PLANS) |
| canon note | 全プランで Canon 編集は無料 | — |

## States
- current: 現行プランのカードを強調
- 決済導線は P1(表示と上限管理のみ)

## Interactions
- P1: Stripe Checkout(Web)/ ストア IAP

## AI Behaviors
none

## 設計の根拠(`../../research/ooc.md` §6, §9)
OOC は **サブスクを持たない**。1,000〜100,000 クレジットの単価はほぼ一定で、**まとめ買い割引が実質ない**
(むしろ大口がわずかに割高)。最上位生成は約195クレジット、無料枠は1日約300 = **1〜3通**。
$14.49/10,000クレジットなら**最上位1通 ≒ $0.28**。
その結果、否定レビュー61件のうち **約69%が金の問題**。

対する設計:
1. **Free でも Standard は無制限**。OOC が有料の壁の向こうに置いた Story Mode をこちら側に出す
2. **$9.99 は Character.AI Plus と同額** — 北米ユーザーが相場として内面化している価格
3. **Web直販は2割安**(Stripe。ストア手数料15〜30%が原資)
4. **Canon の編集は常に無料**。「AIが忘れたせいで金がかかる」という最大の憎悪を構造的に消す
5. **残高を失効させない**。OOC は退会時に全額失効・返金不可

[要確認] Free の無制限は 1ターンあたり原価の実測がゲート。実測前は公正利用上限(`lib/ratelimit.ts`)を併設する。
