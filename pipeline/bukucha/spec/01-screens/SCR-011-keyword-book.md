# SCR-011: Keyword Book
- route: /create(Step "World" 内のセクション)
- auth: authenticated (owner)
- purpose: 世界の固有名詞を、必要なときにだけ思い出させる。

## Layout
```
 World notes
 ┌──────────────────────────────────────┐
 │ triggers: umbrella, rain, forecast   │
 │ The umbrella is his father's, navy,  │
 │ one broken rib he never fixed.       │
 │                       [applies to ▾] │
 └──────────────────────────────────────┘
                             + Add a note
```

## Components
| Component | Behavior | Data |
|---|---|---|
| triggers | 語の配列。直近テキストに出たら本文を注入 | KeywordEntry.keywords |
| body | 注入される本文(600字まで) | KeywordEntry.body |
| scope | 全 Intro / 特定 Intro | KeywordEntry.introId |

## States
- empty: 「Nothing here yet. Notes are optional.」
- 生成直後: AIF-005 が3〜5件を書いた状態から始まる

## Interactions
- 追加 / 編集 / 削除(いずれもビルダー内のフォーム)

## AI Behaviors
- 注入は `matchKeywords()`(決定的)。生成は AIF-005 の一部

## ベンチマークとの差
**OOC は同時にアクティブにできる Keyword Note を3件に制限している**(`../../research/ooc.md` §4)。
これは記憶を殺している制約であり、そのまま否定レビュー23%につながっている。
ここに上限は置かない。**どれを使うかを選ぶのはモデルの仕事であって、作者や読者の仕事ではない。**
