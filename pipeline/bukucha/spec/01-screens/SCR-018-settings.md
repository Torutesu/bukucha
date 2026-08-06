# SCR-018: 設定(年齢確認・安心フィルター)
- route: /settings
- auth: authenticated
- purpose: 安全と嗜好の管理。NSFW Phase 1の要(生年月日→フィルター解除)

## Layout
```
┌──────────────────────┐
│ [←] 設定               │
│ ── 表示 ──             │
│ テーマ (システム/ライト/ダーク) │
│ ── コンテンツ ──          │
│ 生年月日 [____年_月_日]     │ ← 未設定なら入力フォーム。設定済みは表示のみ(変更不可)
│ 安心フィルター [ON ●━ OFF]  │ ← birthDate未設定 or 18歳未満はトグル無効+説明
│   "OFFにすると、大人向けの     │
│    センシティブな表現を含む     │
│    物語が表示されます"        │
│ ── 通知 ── (P1のためプレース │
│    ホルダのみ非表示)         │
│ ── アカウント ──          │
│ メール/連携アカウント表示       │
│ 退会 ▸                 │
└──────────────────────┘
```

## Components
| Component | Behavior | Data |
|---|---|---|
| ThemeSelect | 即時反映+永続化 | localStorage |
| BirthDateForm | 一度設定したら変更不可(不正な行き来を防ぐ)。設定時に確認ダイアログ「正しい生年月日を入力してください。あとから変更できません」 | PATCH /api/me |
| SafeFilterToggle | 18歳以上のみ操作可。OFF操作時に確認モーダル(内容説明+「18歳以上です」チェックボックス)。**判定・強制はサーバー側**(schema不変条件#1,2) | PATCH /api/me |
| WithdrawFlow | 確認2段→退会(User論理削除+作品はSUSPENDED) [ASSUMED] | DELETE /api/me |

## States
- loading / error / success
- underage(18歳未満): トグルはグレーアウト+「18歳になったら解除できます」

## Interactions
- フィルターOFF → 確認モーダル→PATCH→以降のホーム/検索/詳細でR15が出現
- フィルターON戻し → 即時反映(確認なし)

## AI Behaviors
- none
