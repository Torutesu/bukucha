# SCR-024: Canon (memory ledger) ★
- route: /play/[routeId] 内のパネル / デスクトップは右レール常駐
- auth: authenticated
- purpose: **物語の記憶を読者のものにする。** この製品の存在理由。

## Layout
```
 Canon                       12 settled facts
 What the story treats as true. Fix anything
 that is wrong — it costs nothing, and the
 next turn will use it.
 [ Add something the story must remember ][Add]

 person
  ★ You told him your name is Wren.        ×
 relationship
  ☆ He has not called you by name since.   ×
 promise
  ★ You said you would come back Thursday. ×
 world
  ☆ The studio closes at six.              ×

 Standing note
 [ Anything that should always be true of you ]
 Story so far
 (rolling summary)
 [ Save note ]            [ Close ]
```

## Components
| Component | Behavior | Data |
|---|---|---|
| fact list | カテゴリ別。**各行は直接編集できる入力欄**(2タップで直せること) | GET .../canon |
| pin (★/☆) | ピン留めは**常に注入される** | PATCH .../canon/{id} |
| remove (×) | 論理削除(`isActive=false`) | PATCH |
| add | 自由入力。追加された事実は `pinned=true` で入る | POST .../canon |
| standing note | フィクション外の常設メモ | PUT .../memory |
| story so far | ローリング要約(読み取り専用) | RouteMemory |

## States
- empty: 「Nothing settled yet. Facts land here as the story establishes them.」
- 巻き戻し後: 巻き戻し点より後の **AI 抽出**事実は消える。**自分で書いた事実は残る**

## Interactions
- 追加 / 編集(blur で保存)/ ピン / 削除 → **すべて即時、無料、確認なし**
- 次のターンから反映される

## AI Behaviors
- AIF-001: 毎ターン後に構造化抽出(最大3件)。既存と重複したら捨てる
- 注入: pinned優先 → 直近テキストとの一致 → 新しさ。上限40件、**ユーザーから見た保持上限なし**

## なぜこれが中心なのか
`../../research/ooc.md` §9 の実測:

- OOC の否定レビュー **23%** が「明示的に覚えさせた設定を忘れる」
- OOC は App Store の説明文で **"Deep Memory: Companions that truly remember your shared history"** と宣伝している
- そして**忘れた設定を教え直すのにまたクレジットを消費する**(二重の罰)
- 構造的な原因: Keyword Note の**同時アクティブ3件**制限 + ローリング要約の非可逆圧縮

つまり**競合が自ら掲げた公約を、競合自身が守れていない**。
ここを構造で解き、**編集を永久に無料と約束する**ことが、この製品の一文の説明になる。

不変条件(02-schema #4): **Canon の読み書きは、いかなるプランでも課金・計量の対象にしない。**
これは価格表の脚注ではなく、コードで守られる契約である。
