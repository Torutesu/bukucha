# SCR-005: 作品詳細(シチュエーション)
- route: /s/[situationId]
- auth: public (contentLevel=R15はフィルタOFFユーザーのみ。対象外ユーザーには404相当の「表示できません」)
- purpose: ラノベの「あらすじページ」。期待を醸成して「はじめる」に流す

## Layout
```
┌──────────────────────┐
│ [←]              [♥ 1.2k]│
│ ┌────────────┐        │
│ │  表紙画像(3:4)  │        │
│ └────────────┘        │
│ タイトル(大)              │
│ by 作者ニックネーム  📖8.4k読者│
│ [溺愛][身分差][R15🔞]      │ ← contentLevel=R15の場合のみ🔞バッジ
│ ── 世界観 ──            │
│ (worldSetting 全文。折りたたみ│
│  8行超は「もっと見る」)       │
│ ── 登場人物 ──           │
│ [画像+名前+関係性] ×1..3   │
│ ── 冒頭をのぞき見 ──       │
│ ┌ 導入プレビュー ┐          │ ← intros[0].introText の先頭400字+グラデーション
│ │ (ノベル書体で表示) …     │
│ └─────────────┘        │
├──────────────────────┤
│ どこから始める?            │
│ (●) 放課後の教室で         │ ← IntroVariantラジオ選択(1件ならセクション非表示)
│ ( ) 雨の帰り道で           │
│ [ この物語をはじめる ▶ ]     │ ← 固定フッターCTA
└──────────────────────┘
```

## Components
| Component | Behavior | Data |
|---|---|---|
| LikeButton | トグル。未ログインはSCR-017(returnTo=現URL) | POST/DELETE /api/situations/:id/like |
| CoverHeader | 表紙+タイトル+作者+読者数 | GET /api/situations/:id |
| TagList | タップでSCR-003(該当タグ検索) | 同上 |
| CharacterCards | 横並びカード。タップで人物詳細モーダル(personality/speechStyle表示) | 同上 |
| IntroPreview | intros[0].introText先頭400字をノベル書体(明朝、行間1.9)で表示 | 同上 |
| IntroSelector | ラジオ。デフォルト=sortOrder 0 | 同上 |
| StartButton | Story作成→SCR-006へ。未ログイン: 未ログイン体験フロー(下記) | POST /api/stories |
| ReportMenu | 右上⋯メニュー→通報(理由選択モーダル) | POST /api/reports |
| ContinueBanner | この作品の既存Storyがある場合、CTA上に「つづきから読む(第N話)」を表示 | GET /api/stories?situationId= |

## States
- loading: スケルトン
- error(404/権限なし): 「この物語は表示できません」+ホームへ
- success: 上記
- suspended(status=SUSPENDED): 「この物語は現在公開されていません」

## Interactions
- はじめる(ログイン済) → POST /api/stories → SCR-006へ遷移
- はじめる(未ログイン) → **ゲストStory開始**: SCR-006をゲストモードで開き、3往復まで体験可(体験先行 [USER-REQ])。4往復目送信時に登録壁モーダル→SCR-017。ゲストStoryはlocalStorageに保持し、登録完了時にサーバーへ引き継ぎ
- つづきから読む → 既存StoryのSCR-006へ
- 作者名タップ → MVPでは無反応(SCR-013作者ページはP1) [ASSUMED]

## AI Behaviors
- none(プレビューは保存済みintroTextの表示のみ)
