# SCR-003: 検索/タグ
- route: /search?q=&tags=
- auth: public
- purpose: 「今日の気分の欲望」から最短で作品に到達する(欲求性ドリブンの中核 [USER-REQ])

## Layout
```
┌──────────────────────┐
│ [←] ┌検索バー(オートフォーカス)┐ │
│ 選択中: [溺愛 ×][身分差 ×]    │ ← 選択タグ(AND検索)
├──────────────────────┤
│ (未検索時)              │
│ ▼ 欲望から探す           │
│ [溺愛][執着][独占欲][束縛]…  │ ← category=desire 全件
│ ▼ 関係から探す           │
│ [幼なじみ][上司][許嫁][敵]…  │ ← category=relationship
│ ▼ 世界から探す           │
│ [現代][異世界][後宮][学園]…  │ ← category=genre
├──────────────────────┤
│ (検索実行後)             │
│ 並び替え: [人気][新着]      │
│ [カード縦リスト]           │ ← SituationCard(SCR-002と共通)を縦2列グリッド
│ (無限スクロール)           │
└──────────────────────┘
```

## Components
| Component | Behavior | Data |
|---|---|---|
| SearchInput | 300ms debounceでキーワード検索(タイトル/一言/世界観の部分一致) | GET /api/search |
| TagGroups | カテゴリ別タグ一覧。タップで選択に追加し即検索 | GET /api/tags |
| SelectedTags | ×で解除し再検索 | - |
| SortToggle | popular(storyCount) / new(publishedAt) | クエリパラメータ sort |
| ResultGrid | 2列グリッド、無限スクロール(cursor) | GET /api/search |

## States
- loading: グリッドスケルトン
- empty: 「見つかりませんでした」+「この妄想、自分で作ってみませんか?」→ SCR-009へのCTA(検索語をaiDraftInputに引き継ぐ)
- error: メッセージ+再試行
- success: 結果グリッド

## Interactions
- カードタップ → SCR-005
- empty時のCTA → SCR-009(qをプリセット)。未ログインはSCR-017経由
- URLは共有可能(q/tagsをクエリに保持)

## AI Behaviors
- none(MVP。検索語→タグのAIマッピングはP1)
