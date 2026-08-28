# SCR-018: Settings
- route: /settings
- auth: authenticated
- purpose: 年齢・表示・プランを一箇所で。安全の判定はすべてサーバー側で行い、ここは表示のみ。

## Layout
```
 ← Settings
 Plan            → SCR-015 のセクション
 Appearance      [System][Light][Dark]
 Content
   Date of birth [____-__-__] [Confirm]      (一度だけ)
   Mature stories                    ( ●)
   Turn this on to see stories with charged,
   suggestive writing. Explicit content is not
   published here at all.
 Account
   you@example.com
   Delete account
```

## Components
| Component | Behavior | Data |
|---|---|---|
| theme | localStorage `hc_theme` + `data-theme` | — |
| date of birth | **確認モーダル経由。設定後は変更不可** | PATCH /api/me |
| mature toggle | 18歳未満は `disabled`「Unlocks at 18.」。ON には同意モーダル | PATCH /api/me |
| delete account | 二段確認。作品は非公開化、アカウントは匿名化 | DELETE /api/me |

## States
- 未成年 / 未確認: トグル無効 + 理由表示
- サーバーが 403 `age_restricted` を返したらクライアントの状態は変えない

## Interactions
- 生年月日確定 → 18歳以上ならトグルが活性
- Mature ON → 同意 → 一覧・検索・詳細に TEEN が出る

## AI Behaviors
none

## ベンチマークとの差
OOC は App Store レーティング **13+** のまま Adult Content 層を持っている(`../../research/ooc.md` §8)。
北米の規制強化局面(`../../research/na-market.md` §3)で構造的リスクを抱えた状態。
ここは **ストア = 13+ の全年齢体験に固定**し、成人層は将来 Web + 第三者年齢認証に分離する。
自己申告は「合理的な検出措置」として既に不十分と判断されている(Character.AI の顔スキャン導入がその証左)。
