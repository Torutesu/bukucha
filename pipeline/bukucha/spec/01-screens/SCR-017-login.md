# SCR-017: ログイン/登録
- route: /login?returnTo=
- auth: public
- purpose: 最小摩擦の認証。体験の途中(登録壁)から来ても文脈を失わない

## Layout
```
┌──────────────────────┐
│        Bukucha         │
│  物語のつづきを、保存しよう    │ ← returnToがゲストStory由来の時は
│                      │   「ここまでの物語を保存して続きを読む」に変化
│ [ Googleでつづける ]      │
│ [ Appleでつづける ]       │
│ [ メールでつづける ]        │ ← タップでメール入力→magic link送信→確認画面
│                      │
│ 登録すると利用規約とプライバシー │
│ ポリシーに同意したことになります  │
└──────────────────────┘
```

## Components
| Component | Behavior | Data |
|---|---|---|
| OAuthButtons | Google/Apple OAuth [ASSUMED: LINEはP1(審査リードタイムのため)] | Auth.js |
| EmailFlow | メール入力→magic link→クリックで完了 | Auth.js email provider |
| GuestMigration | 認証完了時、localStorageのゲストStory/嗜好タグをサーバーへ移行 | POST /api/stories/migrate-guest |

## States
- loading(認証処理中): ボタンスピナー
- error: 「ログインに失敗しました」+再試行
- emailSent: 「メールを送りました。リンクを開いてください」

## Interactions
- 認証成功 → returnTo(なければSCR-002)へ。初回登録なら preferenceTags を保存
- ゲストStoryがあれば移行してから該当SCR-006へ

## AI Behaviors
- none
