# SCR-002: ホーム
- route: /
- auth: public
- purpose: 欲求性ドリブンの発見。タグ検索を一等地に、セクション型フィードで回遊

## Layout
```
┌──────────────────────┐
│ [Bukuchaロゴ]  [🔍][👤]  │ ← 🔍=SCR-003 / 👤=SCR-014(未ログインはSCR-017)
│ ┌ 検索バー "どんな物語を読む?" ┐│ ← タップでSCR-003へ(入力はSCR-003側)
│ [溺愛][執着][身分差][悪役令嬢]…│ ← 欲望タグチップ横スクロール(preferenceTags優先表示)
│ (安心フィルター適用中 🛈)     │ ← safeFilterOff=falseの時のみ表示。タップでSCR-018へ
├──────────────────────┤
│ ▼ あなたへ            │ ← preferenceTagsマッチ順
│ [カード][カード][カード]→   │   カード=表紙+タイトル+一言+タグ2つ+📖読者数+♥
│ ▼ いま人気の物語        │ ← storyCount 7日間降順
│ [カード][カード][カード]→   │
│ ▼ 新着               │ ← publishedAt降順
│ [カード][カード][カード]→   │
├──────────────────────┤
│ [ホーム][本棚][＋作る][マイ] │ ← 下部タブバー(全認証画面共通)
└──────────────────────┘
```
- PC表示: 全体を中央幅480pxに固定、左右は背景演出 [USER-REQ]。全画面共通

## Components
| Component | Behavior | Data |
|---|---|---|
| SearchBarLink | タップでSCR-003へ遷移(フォーカス状態で) | - |
| TagChips | タップで SCR-003 (該当タグで検索実行済み状態) | GET /api/tags?featured=true |
| SafeFilterBanner | 安心フィルター適用中の告知。タップでSCR-018 | User.safeFilterOff |
| SectionRow ×3 | 横スクロールカード列。カードタップ→SCR-005 | GET /api/home |
| SituationCard | 表紙(3:4)+タイトル(2行省略)+catchphrase(1行)+タグ+読者数+いいね数 | Situation |
| BottomTabBar | ホーム(SCR-002)/本棚(SCR-007)/＋作る(SCR-009 ※未ログインはSCR-017)/マイ(SCR-014) | - |

## States
- loading: セクションごとにカードスケルトン
- empty(公開作品0): シード作品投入前提のため通常発生しない。発生時は「準備中」表示
- error: セクション単位でエラー表示+再試行(全画面エラーにしない)
- success: 上記Layout

## Interactions
- カードタップ → SCR-005
- タグチップタップ → SCR-003(タグ適用済み)
- 「＋作る」→ ログイン済み: SCR-009 / 未: SCR-017(returnTo=/create)
- 安心フィルターバナー → SCR-018

## AI Behaviors
- none(セクションはルールベース。API層で不変条件#2のcontentLevelフィルタ適用)
