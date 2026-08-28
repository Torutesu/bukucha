# SCR-017: Sign in
- route: /login?returnTo=
- auth: public
- purpose: 遊んだものを失わせないために登録してもらう。

## Layout
```
        HEADCANON
 Keep your routes, your canon, and your endings.
 [ Continue with Google ]   (disabled: Coming soon)
 [ Continue with Apple  ]   (disabled: Coming soon)
 [ Continue with email  ]
 By continuing you agree to our Terms and Privacy Policy.
```
ゲスト引き継ぎ経由のときは見出しを
「Save the route you just played and keep going.」に変える。

## Components
| Component | Behavior | Data |
|---|---|---|
| OAuth buttons | env 未設定なら disabled(P1) | — |
| email form | AUTH_DEV_MODE では即ログイン | POST /api/auth/login |
| guest migration | localStorage のゲストルートを移送 | POST /api/routes/migrate-guest |
| preference migration | オンボーディングのタグを移送 | PATCH /api/me |

## States
- error: 「That did not work. Check the address and try again.」

## Interactions
- 成功 → ゲストルートがあればその `/play/{id}`、なければ `returnTo`

## AI Behaviors
none

## ベンチマークとの差
OOC も Google / Apple の2つ。**同じ2つに揃える**(北米の期待値)。違うのは、
ここに来るまでに既に3往復遊んでいて、**その3往復が消えない**こと。
