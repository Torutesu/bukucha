# SCR-001: オンボーディング
- route: /welcome
- auth: public
- purpose: 登録前に嗜好を取得し、最短で「読む体験」へ流す(体験先行 [USER-REQ])

## Layout
```
┌──────────────────────┐
│  Bukucha ロゴ          │
│  "あなたの妄想が、物語になる" │
│                      │
│  Step1: 好きなシチュは?   │
│  [溺愛][執着][幼なじみ]    │
│  [身分差][年の差][策略婚]   │  ← 欲望タグチップ(複数選択可、Tag.category=desire上位12件)
│  [悪役令嬢][異世界][現代]   │
│                      │
│  [つぎへ] (1つ以上選択で活性) │
├──────────────────────┤
│  Step2: おすすめ3作品      │
│  ┌─カード─┐┌─カード─┐    │  ← 選択タグにマッチするPUBLISHED作品3件
│  │表紙/タイトル/一言│      │
│  └────────┘            │
│  [これを読む] → SCR-005    │
│  [あとで選ぶ] → SCR-002    │
└──────────────────────┘
```
- 初回アクセス(cookie無し)のみ表示。2回目以降は SCR-002 へリダイレクト
- ログイン導線はここには置かない(読む体験の後、SCR-006で登録壁)

## Components
| Component | Behavior | Data |
|---|---|---|
| TagChipGrid | タップでトグル選択。選択状態はlocalStorage+未ログインセッションに保持 | GET /api/tags?category=desire |
| RecommendCards | 選択タグでマッチ度順3件。タップでSCR-005へ | GET /api/home/recommend?tags=... |
| SkipLink | 「あとで選ぶ」→ SCR-002 | - |

## States
- loading: チップ/カードのスケルトン表示
- empty(マッチ0件): 人気作品3件で代替(セクションタイトルを「人気の物語」に変更)
- error: 「読み込みに失敗しました」+再試行ボタン
- success: 上記Layout

## Interactions
- タグ選択→つぎへ → Step2表示。選択タグは登録時に User.preferenceTags へ保存
- カードタップ → SCR-005
- あとで選ぶ → SCR-002

## AI Behaviors
- none(推薦はタグ一致+人気度のルールベース [ASSUMED: MVPでは推薦モデルを持たない])
