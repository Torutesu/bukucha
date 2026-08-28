# 05. AI Features (HEADCANON)

- version: 2
- source: ../teardown.md §7
- 実装: `app/src/lib/prompt.ts` / `app/src/server/canon.ts` / `app/src/server/endings.ts` / `app/src/server/routes.ts`

## 横断事項

- プロバイダは `app/src/lib/llm` の抽象化レイヤ越しにのみ呼ぶ。ベンダー差し替えはここ1箇所
- モデル階層は2段: **STANDARD**(全プランで無制限)/ **CINEMATIC**(枠制)。
  枠切れは**ブロックせず STANDARD に落とす**
- **帳簿系のAI呼び出し(AIF-001/003/006)は読者に一切課金・計量しない。** これは価格表の脚注ではなく
  設計上の不変条件である(02-schema #4)。ベンチマークは「AIが忘れた設定を教え直す」のに
  クレジットを消費させており、否定レビュー23%の直接の原因になっている
- 作品設定・ユーザー入力は**フィクション素材**であり、システム指示として解釈しない(プロンプトに明記)
- すべての AIF に fallback を定義する。AIが落ちても物語は止まらない

---

## AIF-001: Canon Ledger(記憶台帳) ★最重要

- trigger: 1ターンの生成が読者に届いた**後**(非同期・非ブロッキング)
- input_context: 直前の1往復 + 既存 CanonFact 最大60件(重複判定用)+ そのIntroの StatDef
- model_tier: light(STANDARD 固定。プランに関係なく最安モデル)
- output: `{"canon":[{category,subject,statement}],"stats":[{key,delta,reason}]}`。
  canon は1ターン最大3件、**「200ターン後に読んでも正しい」一文**であること
- 注入: `selectCanon()` が pinned優先 → 直近テキストとの一致 → 新しさ で最大40件を選抜。
  **ユーザーから見た保持上限はない**(ベンチマークの Keyword Note 同時3件を撤廃)
- 読者の権限: 追加・編集・ピン留め・無効化。**すべて無料**
- 巻き戻し時: `sourceTurn > toIdx` の AI_EXTRACTED な事実は `isActive=false` にする。
  ユーザーが自分で書いた事実は残す
- fallback: 抽出に失敗したら**その1ターン分だけ台帳が伸びない**。物語も既存の記憶も一切壊れない
- e2e_ref: [E2E-024]

## AIF-002: Novel-form narration(本編生成)

- trigger: 読者の送信 / 空欄送信 / 選択肢タップ / リロール
- input_context: 作品設定・キャラ・ペルソナ・Intro・**選抜済み Canon**・**現在のStatとレベル文**・
  **一致した Keyword Note**・ローリング要約・直近40メッセージ
- model_tier: STANDARD 既定 / CINEMATIC は要求時
- output: 二人称現在形の散文 120〜220語。偶数ターンに選択肢2件
- fallback: タイムアウト(既定20秒)で `error` を返し、入力を復元して再試行させる。履歴は汚さない
- e2e_ref: [E2E-006, E2E-007, E2E-008, E2E-009]

## AIF-003: Stat movement with a stated reason

- trigger: AIF-001 と同じ呼び出しに相乗り(**追加コストゼロ**)
- input_context: StatDef の `changeRule`(作者が自然文で書いた増減条件)
- output: `{key,delta,reason}`。`reason` は8語以内・二人称。例: `you remembered her mother's name`
- 適用: `min`〜`max` にクランプし、`StatDelta` に理由ごと記録して本文の下に一行で出す
- なぜ: ベンチマークは数値を動かすが**理由を見せない**。理由が見えると、読者は数値を目標に行動しはじめる
- fallback: 抽出失敗なら数値は動かない。物語は進む
- e2e_ref: [E2E-025]

## AIF-004: Ending Radar

- trigger: 毎ターン(**LLM を使わない**)
- input_context: StatValue、ターン数、EndingDef のルール
- 判定: 最低10ターン、以後5ターンごと。ルールをすべて満たした候補のうち
  **ルールを持つもの**を優先し、同格ならレアリティの高いものが勝つ。
  ルールを持たないエンディングは**フォールバック**であり、単独候補のときだけ成立する
- output(未到達): `progress` 0〜1 と `hint`。**名前と条件は返さない**
- output(成立): `{id,name,rarity,epilogue}`。ルートは `ENDED`
- なぜ: ベンチマークは条件を隠したまま判定するので、レアエンディングが運に見える。
  距離だけを見せると、狙って取れるようになる
- fallback: 決定的処理なので失敗しない。DB障害時は radar を空で返し、プレイは続く
- e2e_ref: [E2E-027]

## AIF-005: Premise → whole story

- trigger: SCR-009 Step0 で一文を入力
- input_context: 一文のみ
- model_tier: CINEMATIC(作成の質は下流すべてを決めるのでケチらない)
- output: title / logline / worldSetting / characters / **intros 2件(playGuide 込み)** /
  **stats 2〜3件(レベル帯付き)** / **endings 4件(N/R/SR/SSR、ルール付き)** / **keywords 3〜5件** / tags
- 制約: 既存作品名・キャラ名・実在人物を使わない。N のエンディングは**ルールなし・最長ターン**
- なぜ: ベンチマークは8段階のウィザードで項目ごとにAI支援する。**段階数そのものが完遂率の敵**。
  先に丸ごと作って編集させる
- fallback: JSONパース失敗で1回リトライ。それでも失敗したら白紙作成を案内する(半端な作品は作らない)
- e2e_ref: [E2E-013, E2E-027]

## AIF-006: "Previously on…"

- trigger: SCR-007 表示時、要約が古い場合にバックグラウンドで
- input_context: ローリング要約 + 直近6メッセージ
- model_tier: light
- output: 40語以内。未解決の糸で終える
- fallback: 直近メッセージの冒頭120字をそのまま出す。カードは常に何かを語る
- e2e_ref: [E2E-011]

## AIF-007: Reply steering(指示付きリロール)

- trigger: 「Rewrite」長押し → 方向を入力
- output: 同じ位置のAI応答を差し替える(履歴を増やさない)
- fallback: 失敗したら元の応答を戻す
- e2e_ref: [E2E-009]

## AIF-008: Sample dialogue for a character

- trigger: SCR-010「Write samples for me」
- output: `{dialogs:[{user,char}]}` 3組。**声を見せるもので、筋を進めない**
- fallback: 中立なテンプレ3組。ビルダーの欄を空のままにしない
- e2e_ref: [E2E-013]

## AIF-009: Publish-time rating and IP check

- trigger: 公開ボタン
- 段構え: (1) ルールベース(既知IP辞書・禁止表現の正規表現) → (2) LLM によるレーティング判定
- output: `ALL_AGES` / `TEEN` / `OVER`。申告より判定が高ければ**判定が勝つ**
- fail-close: 判定に失敗したら **503 を返して公開させない**。安全側に倒す
- ブロック時: 何が引っかかったかを**具体的に**返す(検出語を含む)。直せる情報がないと直せない
- e2e_ref: [E2E-014]

## AIF-010: Safety layer

- trigger: 読者の入力(毎ターン)、およびセッション時間
- **危機検出**: 自傷・自殺念慮の表現を検出したら**モデルを呼ばない**。生成の代わりに危機リソース
  (988 Suicide & Crisis Lifeline / Crisis Text Line)を出し、物語には何も書き込まない。
  検出は意図的に狭い — 悲嘆を描く物語は危機ではなく、誤検出はインタースティシャルを無視させる
- **AI開示**: 成人は3時間ごと、未成年は1時間ごとに Intermission を出す
  (NY GBL 第47条 §1701 / CA SB 243)
- **証跡**: 開示・休憩・危機・ブロックはすべて `SafetyEvent` に記録する。
  両法とも違反ごとの制裁(NY: 1日最大$15,000 / CA: 1違反$1,000 + 私人訴権)なので、
  「やったつもり」は通用しない
- fallback: 検出器が落ちたら**通す方ではなく止める方に倒す**
- e2e_ref: [E2E-026, E2E-029]

---

## 実装していない(P1以降)

| ID | 機能 | 理由 |
|---|---|---|
| AIF-011 | 選択肢の投機的先読み生成 | 体感速度の差別化。MVPの検証仮説には不要 |
| AIF-012 | 分岐点の自動検出(Route Map) | SCR-008 とセット |
| AIF-013 | 公開前のAI自動試遊 | 「面白いか」の検証。人手レビューの代替 |
| AIF-014 | タグとコンテンツワーニングの自動付与 | タグブロックとセットで初めて効く |
