# SCR-007: 本棚(読んでいる物語)
- route: /bookshelf
- auth: authenticated
- purpose: 積読・再開のハブ。「前回までのあらすじ」で再没入コストをゼロにする

## Layout
```
┌──────────────────────┐
│ 本棚                  │
│ [読んでいる] [完結した]     │ ← StoryStatus タブ
├──────────────────────┤
│ ┌─────────────────┐  │
│ │[表紙] タイトル       │  │
│ │  第12話まで・昨日     │  │ ← 往復数とlastMessageAt相対表示
│ │  ▸ 前回まで: 彼の秘密を │  │ ← lastRecap 2行省略(AIF-004)
│ │    知ってしまった私は…  │  │
│ │            [つづきを読む]│ │
│ └─────────────────┘  │
│ (lastMessageAt降順リスト)   │
├──────────────────────┤
│ [ホーム][本棚][＋作る][マイ] │
└──────────────────────┘
```

## Components
| Component | Behavior | Data |
|---|---|---|
| StatusTabs | ACTIVE / ARCHIVED 切替 | GET /api/stories?status= |
| StoryCard | タップ(カード全体)→SCR-006。長押し/⋯で「完結にする/本棚から削除/作品ページへ」 | Story+Situation |
| RecapText | lastRecapを表示。古い(lastRecapAtIdx < 最新idx-1)場合は「あらすじ更新中…」表示で再生成をトリガー | AIF-004 |

## States
- loading: カードスケルトン
- empty: 「まだ読みかけの物語がありません」+「物語を探す」→SCR-002
- error: メッセージ+再試行
- success: 上記

## Interactions
- カードタップ → SCR-006(該当Story)
- 完結にする → status=ARCHIVED(トースト+取り消しリンク)
- 削除 → 確認ダイアログ→Story削除(Situationは残る)

## AI Behaviors
- AIF-004: あらすじ生成 — 本棚表示時、recapが古いStoryに対しバックグラウンドで再生成し、完了次第カードを差し替え。fallback: 生成失敗時は最終メッセージ冒頭2行を表示
