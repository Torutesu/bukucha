# SCR-012: マイ作品(スタジオ)
- route: /studio
- auth: authenticated
- purpose: 書き手の承認ループの起点。数字が伸びるのを見る場所 [USER-REQ: 書き手が主役]

## Layout
```
┌──────────────────────┐
│ マイ作品        [＋新しく作る]│
│ ┌─────────────────┐  │
│ │ 今週: 📖 読者 214 (+38)  │  │ ← 全作品合算の週間サマリ
│ │      ♥ 89 (+12)       │  │
│ └─────────────────┘  │
│ [公開中][下書き][非公開]      │ ← statusタブ
│ ┌─────────────────┐  │
│ │[表紙] タイトル           │  │
│ │ 📖8.4k  ♥1.2k  📅8/2公開 │  │
│ │ [編集] [統計▾]          │  │ ← 統計▾展開で日別読者数の簡易棒グラフ(14日分)
│ └─────────────────┘  │
├──────────────────────┤
│ [ホーム][本棚][＋作る][マイ]   │
└──────────────────────┘
```

## Components
| Component | Behavior | Data |
|---|---|---|
| WeeklySummary | 直近7日の読者増・いいね増(前週比) | GET /api/studio/summary |
| StatusTabs | PUBLISHED / DRAFT / PRIVATE | GET /api/studio/situations?status= |
| WorkCard | [編集]→SCR-009(該当ID)。カードタップ→SCR-005(公開中のみ)。⋯メニュー: 非公開にする/削除 | Situation |
| MiniChart | 日別storyCount棒グラフ(14日) | GET /api/studio/situations/:id/stats |

## States
- loading / error / success
- empty: 「最初の物語を作ってみましょう」+大きな[＋作る]ボタン+「一文の妄想から、AIが下書きします」の説明

## Interactions
- ＋新しく作る → SCR-009
- 編集 → SCR-009(編集モード)。公開中作品の編集保存は即反映 [ASSUMED: 再審査はAIF-006を保存時に再実行]
- 削除 → 確認(進行中の読者Storyは読み続けられる旨を表示。Situationは論理削除=SUSPENDED扱い) [ASSUMED]

## AI Behaviors
- none(統計はルールベース集計)
