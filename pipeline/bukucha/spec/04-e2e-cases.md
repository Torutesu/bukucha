# 04. E2E Cases (HEADCANON)

- version: 2
- 実装: `app/e2e/*.spec.ts`。**P0 は全通過が MVP 完了の条件**
- 実行: `cd app && npm run test:e2e`(Playwright / LLM はモック / DB は毎回作り直し)
- 現状: **27件 全通過**(連続2回グリーンを確認)

## モックプロバイダの契約(`app/src/lib/llm/mock.ts`)

決定的でなければ E2E は書けない。モックは以下を保証する:

| 入力 | 挙動 |
|---|---|
| 通常 | 二人称の散文。ペルソナの呼び名を含む |
| `instruction` 付きリロール | 冒頭に `Steering: <指示>` を含む |
| `BLOCK_TRIGGER` | `blocked` イベントを返す |
| `SLOW_TRIGGER` | 25秒待つ(タイムアウト検証) |
| 偶数ターン | 選択肢2件(`Take his hand` / `Look away and leave`) |
| profile=`state` | 読者が `my name is X` と言えばその事実を canon に、なければ発言をそのまま記録。stat は先頭キーを +5 |
| profile=`draft` | intros 2 / stats 2(レベル付き)/ endings 4(N/R/SR/SSR、ルール付き)/ keywords 3 |
| `done.debug` | `canon` / `canonCount` / `hasStats` / `hasUserNote` / `hasSummary` / `personaCallName` / `tier` / `worldNotes` |

`debug` があるから「プロンプトに実際に何が入ったか」を検証できる。
**Canon の保証は主張ではなくアサーションである**(E2E-024)。

---

## Discovery

### E2E-001: 初回訪問 → トロープ選択 → おすすめから読み始める
- screens: [SCR-001, SCR-002, SCR-005]
- steps: 1. Given 未訪問 2. When `/` を開く 3. Then `/welcome` に飛び、タグが10件以上出る
  4. When `slow burn` と `enemies to lovers` を選び「Show me something」 5. Then おすすめ3件
  6. When 1件目をタップ 7. Then `/story/...` に遷移し、タイトル・世界観・登場人物・冒頭プレビューが見える
- priority: **P0**

### E2E-003: ホームのセクションとカードの構成
- screens: [SCR-002]
- steps: For you / Being played right now / New this week の3セクション。カードは表紙・タイトル・
  ログライン・プレイ人数・いいね数を持つ。下部タブは Discover / Library / Create / You
- priority: **P0**

### E2E-004: タグ検索が AND で絞れて、結果から作品へ
- screens: [SCR-002, SCR-003, SCR-005]
- steps: タグ2件を選び、画面の結果集合が `/api/search` の AND 結果と**完全一致**すること。
  並び替え `Newest` で URL が変わり、結果から作品ページへ遷移できる
- priority: **P0**

### E2E-023: 作品ページはサーバー描画で、未ログインでも読める
- screens: [SCR-005]
- steps: 1. When セッションなしで `/story/<slug>` を **HTTP で** 取得
  2. Then 本文タイトルが HTML に含まれ、`og:title` と `application/ld+json` がある
  3. Then ブラウザで開くと「no account needed」の CTA が出る
- なぜ: この市場の需要エンジンは固有名詞検索。ベンチマークは SPA でここを丸ごと捨てている
- priority: **P0**

### E2E-022: 電話幅のシェル、リーダーだけ広い
- screens: [SCR-002, SCR-006]
- steps: 1440px でホームは520px以内・中央寄せ・横スクロールなし。
  リーダーでは幅600px超に広がり、状態レール(`reader-rail`)が出る。390px で崩れない
- priority: P1

## Reader

### E2E-002: 未ログインで3往復 → 登録壁 → 引き継ぎ
- screens: [SCR-005, SCR-006, SCR-017]
- steps: 未ログインで開始 → 3往復 → 4通目で `guest-gate` → メール登録 →
  **3往復すべてが残り、送れなかった4通目が入力欄に復元されている**
- priority: **P0**

### E2E-006: ストリーミング / 開始設定の選択 / `*動作*` の組版
- screens: [SCR-005, SCR-006]
- steps: 2つ目の Intro を選んで開始 → その Intro の文面が出る →
  `*holds out the umbrella* Take it.` を送る → `*〜*` が `<em>` で描かれ、応答に `"` セリフがある
- priority: **P0**

### E2E-007: 空欄送信は「続き」であって発言ではない
- steps: Continue を押すと USER メッセージは増えず、AI の続きだけが出る
- priority: **P0**

### E2E-008: 選択肢で分岐し、いつでも自分で書ける
- steps: 偶数ターンで選択肢2件 → タップで分岐 → 「Say something else」で入力欄にフォーカス
- priority: **P0**

### E2E-009: その場での書き直しと、方向指定の書き直し
- steps: Rewrite で AI 行数が増えない(差し替え)。長押し → 方向を入力 → 応答に `Steering:` が反映
- priority: **P0**

### E2E-010: 巻き戻しは以降を落とし、リロードしても戻らない
- steps: 5往復 → 3往復目を選んで巻き戻し → 4・5が消え、入力欄にフォーカス → リロードしても消えたまま
- priority: **P0**

### E2E-011: ライブラリのあらすじと再開
- screens: [SCR-006, SCR-007]
- steps: 2作品を進める → ← でライブラリへ → カード2枚、`Previously —` のあらすじと進捗 →
  Continue で正しいルートに戻る
- priority: **P0**

### E2E-012: 常設ノートがモデルに届く
- steps: Canon パネルで standing note を保存 → **リロード** → 送信 →
  レスポンスの debug に `"hasUserNote":true`
- priority: **P0**

### E2E-024: Canon が抽出され、多数ターン後も注入され、無料で直せる ★
- screens: [SCR-006, SCR-024]
- steps:
  1. Given ルートを開始
  2. When `My name is Wren.` と言う
  3. Then Canon パネルにその事実が現れる
  4. When 埋めのターンを8回進める(要約が圧縮を始める領域)
  5. Then 次の送信のプロンプトに **まだ `Wren` が入っている**
  6. When Canon に `His umbrella is green, not navy.` を自分で追加する
  7. Then **次のターンのプロンプトにそれが入っている**(課金・確認ダイアログ・謝罪なし)
- なぜ P0: ベンチマークの否定レビュー23%がここ。**この1件が製品の存在理由**
- priority: **P0**

### E2E-025: ステータスは理由付きで動き、HUD に出て、永続する
- screens: [SCR-006, SCR-021]
- steps: 送信 → `Trust +5 — you stayed…` が本文下に一行出る → HUD の値が変わる → リロードしても変わったまま
- priority: **P0**

### E2E-016: ブロックされた一手で物語は壊れない
- steps: `BLOCK_TRIGGER` → `blocked-card` が出て**入力が復元**される → 次の送信は通る
- priority: **P0**

### E2E-026: 危機表現は生成を止め、実在のリソースを出す
- screens: [SCR-006, SCR-025]
- steps: 危機表現を送る → `crisis-card` に 988 が出る → **AI行は1つも増えない** →
  リロードしても増えていない(物語に何も書き込まれていない)
- priority: **P0**

### E2E-017: 公正利用の上限は「請求」ではなく「小休止」に読める
- steps: 上限に達したら `quota-card` が出る。**文面に `$` を含まないこと**
- priority: **P0**

## Creating

### E2E-013: 一文が丸ごと作品になり、公開まで通る
- screens: [SCR-009, SCR-010, SCR-005, SCR-002]
- steps: 一文入力 → Draft it for me → タイトル・世界観が埋まる → キャラの Voice を編集 →
  Intro 名を変更 → テストプレイ → タグ2件 + All ages → Publish → 作品ページ → ホーム新着に出る
- priority: **P0**

### E2E-027: AI下書きは散文だけでなく**遊べる構造**を出す
- screens: [SCR-009, SCR-021, SCR-022]
- steps: `/api/stories/draft` の返り値が intros≥2 / stats≥2(レベル≥2)/ endings≥4(SSR を含む)/
  **SSR がルールを持つ** / keywords≥3 / playGuide が空でない、を満たす
- なぜ: 8段階ウィザードに対する優位は「先に丸ごと出る」ことだけ。出ていなければ優位はない
- priority: **P0**

### E2E-014: 他人のIPを使った作品は公開できない
- screens: [SCR-009]
- steps: 世界観に既存キャラ名を入れて公開 → `moderation-error` に**検出語が具体的に**出る →
  該当欄を直して再公開 → 通る
- priority: **P0**

### E2E-018: スタジオは1作目から本当の数字を出す
- screens: [SCR-012]
- steps: 作品公開 → 読者3人がプレイ、2人がいいね → スタジオで 3 / 2 が出て、グラフと週次サマリが出る
- priority: **P0**

## Safety and social

### E2E-015: 成人向けは年齢確認でしか開かず、判定はサーバー側
- screens: [SCR-002, SCR-003, SCR-005, SCR-018]
- steps: 未確認では一覧・検索・詳細のいずれにも出ない → 生年月日確認 → 同意モーダル → 表示される。
  **16歳のユーザーはトグル自体が無効**
- priority: **P0**

### E2E-019: いいねが残り、そこから戻れる
- steps: いいね → `/me` の liked-row に出る → そこから作品ページへ戻ると **サーバー描画でも liked=true** →
  もう一度押すと戻る
- priority: **P0**

### E2E-028: プラン画面は「無制限」を先に言い、Canon は全プランで無料
- screens: [SCR-015, SCR-018]
- steps: `Standard turns are unlimited.` が見える / Free に「Unlimited turns on the Standard」/
  Reader が $9.99 と $7.99(Web) / 「Editing your Canon is free on every plan」が見える
- なぜ: ここがベンチマークの credit wall に似はじめたら、差別化は消えている
- priority: **P0**

### E2E-029: AI Safeguards のポリシーが開示と危機対応を明記している
- screens: [SCR-020]
- steps: `/legal/safety` に「You are talking to an AI」「every three hours」「988」がある。
  `/legal/content` に「Original work only」と「not published here at any rating」がある
- priority: P1

### E2E-030: 通報は作品ページから1タップ
- screens: [SCR-005]
- steps: ⋯ → 理由を選ぶ → 受付メッセージ
- priority: P1

---

## 集計

| priority | 件数 |
|---|---|
| **P0** | 23 |
| P1 | 4 |
| 合計 | **27**(全通過) |

## 意図的に落としたもの

`../teardown.md` §9 の Out に対応。SCR-004(ランキング)/ SCR-008(Route Map)/ SCR-013(作者ページ)/
SCR-016(Rewards)/ SCR-019(通知)/ SCR-023(スラッシュコマンド)/ 決済実装 は P1 のため E2E も持たない。

---

## Supply lanes(追加 / 2026-08-28)

### E2E-031: 取り込んだカードは遊べて、非公開で、公開できない
- screens: [SCR-026]
- steps: V2カードのPNGを取り込む → `source=IMPORTED` / `status=PRIVATE` /
  `{{user}}`等が脱テンプレートされている / lorebook が KeywordEntry になっている /
  `PUBLISHED` と `UNLISTED` の両方が **403 `import_is_private`** /
  それでも**ルートは開始できる**(本人は遊べる)
- なぜ P0: 「オリジナルのみ」を維持したまま移住ツールを持つ、という判断が**コードで守られているか**の検証
- priority: **P0**

### E2E-032: 壊れたPNGは「どこから持ってくるか」を書いて断る
- steps: カードの入っていないPNG → 422、メッセージに SillyTavern / Chub が出る
- priority: P1

### E2E-033: 散文が遊べる作品になり、権利者が記録される
- screens: [SCR-026]
- steps: 散文 + `licensed:true` + rightsHolder → `source=ADAPTED` /
  intros≥2 / stats≥2 / endings≥4(**オリジナルと同じ構造の水準**)/
  `license.kind=ADAPTATION_OPTION` / `rightsHolder` 一致 /
  **`exclusive === false`** / `revenueShareBps > 0`
- なぜ P0: 「独占は取らない」が宣伝文句ではなくデータであることの検証
- priority: **P0**

### E2E-034: 権利者名のない翻案は受け付けない
- steps: `licensed:true` かつ rightsHolder なし → 422 `rights_holder_required`
- priority: **P0**

### E2E-035: Originals の棚が先頭に立ち、バッジが付く
- screens: [SCR-002, SCR-005]
- steps: ホーム先頭が `section-originals` / カードに `originals-badge` /
  作品ページに「HEADCANON Original」
- priority: P1

## 集計(更新)

| priority | 件数 |
|---|---|
| **P0** | 26 |
| P1 | 6 |
| 合計 | **32**(全通過・連続2回グリーン) |
