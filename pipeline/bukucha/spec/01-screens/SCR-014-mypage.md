# SCR-014: マイページ
- route: /me
- auth: authenticated
- purpose: アカウントハブ(プロフィール・ペルソナ・いいね・設定への入口)

## Layout
```
┌──────────────────────┐
│ [アバター] ニックネーム [編集]  │
│ ── わたしの設定(ペルソナ) ──  │
│ ┌ みお(デフォルト) [編集] ┐   │ ← Persona一覧。物語での「わたし」
│ [＋ペルソナを追加]           │
│ ── いいねした物語 ──        │
│ [カード横スクロール →すべて見る] │
│ ── その他 ──             │
│ ▸ 設定(SCR-018)          │
│ ▸ 利用規約 / プライバシー     │
│ ▸ ログアウト               │
├──────────────────────┤
│ [ホーム][本棚][＋作る][マイ]   │
└──────────────────────┘
```

## Components
| Component | Behavior | Data |
|---|---|---|
| ProfileEditor | ニックネーム(20字)・アバター変更(モーダル) | PATCH /api/me |
| PersonaList | 追加/編集モーダル: name/callName/profile/isDefault | CRUD /api/me/personas |
| LikedRow | いいね作品カード。→すべて見るで一覧(/me/likes) | GET /api/me/likes |
| MenuLinks | 設定/規約/ログアウト | - |

## States
- loading / error / success
- empty(いいね0): セクション非表示

## Interactions
- ペルソナ追加 → モーダル保存。デフォルト切替は既存デフォルトを自動解除
- ログアウト → 確認→SCR-002へ

## AI Behaviors
- none
