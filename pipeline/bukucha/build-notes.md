# Build Notes (Stage 3)

- date: 2026-08-06 (MVP) / 2026-08-07 (Zeta詳細インタラクション追補)
- 実装: `app/` (Next.js 16 App Router + PostgreSQL + Prisma 6 + Playwright)
- 結果: **E2E 26件 全通過**(連続2回green) / `next build` 成功 / `tsc --noEmit` エラー0 / `eslint` エラー0

## 2026-08-07 追補: Zeta詳細インタラクション(decisions.md 同日エントリ参照)

| 区分 | 内容 |
|---|---|
| AIF-008 返信候補 | ✦ボタン→候補2案→タップで入力欄へ。50回/日クォータ(User.suggestDate/suggestUsed)。`POST /api/stories/:id/suggest` |
| AI応答の直接編集 | AI行タップ→操作列→インライン編集。`PATCH /api/stories/:id/messages/:idx`(AIロール限定) |
| 分岐・並行ルート | AI行タップ→「ここから分岐」(`POST /api/stories/:id/branch`、atIdxまで複製+memory引き継ぎ)。メニュー→ルートシートで一覧・切替 |
| 選択肢ON/OFF | `Story.choicesEnabled`。メニューのトグルで途中切替 |
| 高品質モデル切替 | `Story.useMidModel` → LLM optionsの`tier`でlight/mid切替。`modelUsed`は`provider:tier`形式に |
| 組版・追従 | 「」セリフ強調(.dialogue)/AI側`*〜*`地の文/入力ライブプレビュー/自動追従停止+「↓最新へ」チップ/ヘッダー自動非表示(自動スクロールでは隠さない)/導入フェードイン |
| E2E | E2E-030〜036 追加(P0 6件+P1 1件)。トグル/いいねは冪等リトライヘルパーで安定化 |

## 2026-08-07 追補2: プロダクト洗練パス(UIポリッシュ)

| 区分 | 内容 |
|---|---|
| 触感 | 全ボタン/カードリンクに押下フィードバック(scale 0.965)+transition。btn-primaryにソフトシャドウ+hover輝度 |
| 出現アニメーション | メニュードロワー(右スライド)/ルートシート(下からスライド+グラバー)/各モーダル(pop)/バックドロップ(fade)。すべて`prefers-reduced-motion`対応 |
| ローディング | リーダー初期ロードと返信候補待ちをスケルトン(shimmer)化 |
| 選択肢カード | 「── どうする? ──」ヘッダー+◆マーカー+hover時のprimaryティント |
| 返信候補チップ | accent色の✦+ボーダー、フェードイン |
| BottomTab | ブラー背景、アクティブタブに太字+ドットインジケータ |
| カード | SituationCardに押下フィードバック、グラデ表紙のタイトルにテキストシャドウ |

## 2026-08-13 追補4: 送信体験と物語進行(research/zeta-progression-ux.md)

| 区分 | 内容 |
|---|---|
| 送信3モード | 💬セリフ/✳️動作/🎬展開のモードチップ。StoryMessage.kindで永続化。ACTIONはプロンプトで`*〜*`化+斜体バブル、DIRECTIONは`(展開指示:〜)`化+中央演出行「── 🎬 〜 ──」。プレースホルダ・ライブプレビューもモード連動 |
| 展開プリセット | 時間経過/場面転換/予想外の出来事/距離が縮まる/クライマックスの5種をワンタップ送信(Zetaの`*あらすじ:〜*`裏ワザの製品化)。送信後はセリフモードへ自動復帰 |
| 打ち直し | 自分の発言タップ→「✍ 打ち直す」= rewind+本文・モードを入力欄に復元 |
| プロンプト | システム規則に展開指示の扱いを追加。履歴・リロールもkindで整形 |
| E2E | E2E-037〜039追加(P0)。全29件green |

## 2026-08-07 追補3: プロダクト洗練パス2(体験の質)

| 区分 | 内容 |
|---|---|
| 等速タイプライタ | ストリーミングのチャンクが塊で届いても、表示はrAFで等速に追いつく方式に変更(受信=streamTargetRef / 表示=streamText)。「文章が連続的に出てくる体験」[USER-REQ]の質を担保。`prefers-reduced-motion`時は即時表示 |
| スケルトン統一 | ホーム/検索/本棚/作品詳細の`animate-pulse`プレースホルダをshimmerスケルトンに統一 |
| マイクロインタラクション | いいねハートのポップ(scale 1.45バウンス)+色トランジション。ストリーミングキャレットをprimary色に |

### 追補で見つけて直した実バグ
1. **遅延fetchによる楽観更新の上書き**: 初期ロード完了前にメニューのトグルや記憶を操作すると、遅れて届いたfetch結果が上書き(空ノート保存も発生)。ロード完了までメニューのデータ依存項目をdisabledに。
2. **記憶保存のエラー握りつぶし**: 保存失敗でも「保存しました」が出ていた。`r.ok`チェック追加。
3. **自動スクロールでヘッダーが隠れる**: 送信後・ロード後のscrollIntoViewを下方向スクロールと誤認しヘッダーを隠していた。programmaticフラグで抑止。

## 実装したもの

| 区分 | 内容 |
|---|---|
| 画面 | SCR-001,002,003,005,006,007,009,010,012,014,017,018,020(13画面。SCR-010は spec通り `/create/[sid]/characters/[cid]` の独立ルート) |
| API | 03-api.md の全エンドポイント(SSEストリーミング含む) |
| AI機能 | AIF-001〜007(全件fallback実装済み) |
| スキーマ | 02-schema.md 通り(15モデル/8 enum)。不変条件はAPI層で強制 |
| E2E | P0 19件(01-discovery/02-reader/03-creation/04-safety-social) |

## スペックからの逸脱 [要記録]

1. **認証**: Auth.js(Google/Apple OAuth)を入れず、**署名Cookieの自前セッション+メールログイン**にした。`AUTH_DEV_MODE=true` でmagic link送信を省略して即ログイン(開発/E2E用)。
   - 理由: OAuthはクレデンシャル発行が必要でMVPの検証仮説に不要。SCR-017のOAuthボタンは `oauthEnabled=false` でdisabled表示。
   - **P1でやること**: Auth.js導入、メールmagic link送信、LINEログイン。
2. **画像アップロード**: `public/uploads` へのローカル保存。**本番はオブジェクトストレージ必須**(`src/app/api/uploads/route.ts`)。
3. **キャラ/表紙画像**: SCR-009のプリセット表紙12種は未実装(タイトル頭文字からグラデーション生成のプレースホルダ)。AI画像生成はspec通り対象外。
4. **AIF-005 選択肢の頻度**: spec「2〜4往復に1回」を **「ユーザーの偶数ターンごと」** に確定(決定的にしないとE2Eが不安定なため)。
5. **E2E並列度**: 共有DBのため `workers: 1`。並列化にはワーカー毎DBが必要。
6. **Playwrightブラウザ**: 環境同梱のchromium(build 1194)を `executablePath` で直接指定(Playwright 1.62のpinビルドと不一致のため)。

## 実装中に見つけて直した実バグ(スペック起因ではない)

1. **作成ウィザードの保存取りこぼし**: フォームのonBlur保存がfire-and-forgetで、素早くステップ移動すると未保存のまま公開に進めた。保留中の保存を追跡し、ステップ移動・公開の前に `flushSaves()` で必ず待つように修正。
2. **公開APIエラーの握りつぶし**: 422等のエラーレスポンスがUIに何も表示されず無反応に見えた。`publish-error` として表示するよう修正。
3. **ロード前送信の消失**: SCR-006で物語の読み込み完了前に送信できてしまい、メッセージが黙って捨てられた。読み込み中は入力欄・送信ボタンをdisabledに。

## 改善案(スペックへのフィードバック / 未実装)

- **SCR-005の「つづきから読む」**: 現在は最新Story1件のみ表示。SCR-008(ルート管理)実装時に複数ルートの選択UIへ拡張すべき。
- **AIF-003(要約メモリ)の発火**: 現状「10往復ごと+`storyTurn`内で非同期」。spec通りの「画面離脱時」トリガーはbeacon等が必要でP1送り。
- **モデレーションのIP辞書**: `src/lib/policy.ts` にハードコード。運用では外部辞書+管理画面が要る。
- **レート制限**: DBカウントベース。スケール時はRedis等へ。
- **通報の運用面**: Reportは記録のみで管理画面がない(P1)。
- **`legal/*` の文面**: `[要確認]` プレースホルダのまま。**公開前に法務レビュー必須**。

## 動かし方

```bash
cd app
npm install
# PostgreSQL 起動後
npx prisma migrate dev
npm run db:seed          # タグ+シチュエーション21本
npm run dev              # http://localhost:3000

# E2E(mock LLM)
npm run test:e2e
```

環境変数(`.env`):
- `DATABASE_URL` / `AUTH_SECRET` / `AUTH_DEV_MODE`
- `LLM_PROVIDER`(`mock` or 未設定=OpenAI互換), `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL_LIGHT`, `LLM_MODEL_MID`
- `MESSAGE_RATE_LIMIT`(既定60/時), `GENERATION_TIMEOUT_MS`(既定20000)

## 次ステージへの引き継ぎ

- **実LLM接続**: `LLM_PROVIDER` を外して `LLM_BASE_URL`/`LLM_API_KEY`/モデルIDを設定するだけで動く(`src/lib/llm/openai.ts`)。E2E-090(実API smoke)は未実行。
- **1ターン原価の実測**が00-prd.mdの成功基準に入っている。`StoryMessage.modelUsed` は記録済みだが**トークン数の記録は未実装** — 課金設計に進む前に追加が必要。
- **R18派生**(`variants/web-r18-variant.md`)の前提5点は実装済み: ContentLevel3値 / サーバー側フィルタ(`src/lib/policy.ts`) / 年齢確認の独立化 / LLM抽象化レイヤ / Web直販前提(ストア決済なし)。

## 共有用スクリーンショット

実際に動作しているWeb版の全画面を撮影し、共有ページ(Artifact)を生成できる:

```bash
cd app
npm run shots                  # screenshots/capture.spec.ts → shots/*.png (gitignore)
python3 build-share-page.py    # shots_web/*.webp に圧縮し、data URI埋め込みHTMLを出力
```

- 撮影は通常のE2E(`npm run test:e2e`)には含めない(`playwright.shots.config.ts` で分離)
- `next.config.ts` の `devIndicators: false` は開発バッジの写り込み防止

## 2026-08-13 追補5: メッセージ周りのUI拡充

- 送信ステータス「✓ 送信済み」(生成中のみ)+●●●タイピングインジケータ
- タイムスタンプ: 操作列に時刻、日付境目にセパレータ「── M月D日 ──」
- 「⏩ つづき」ボタン(最新応答の操作列。空欄送信のワンタップ化)
- 下書き自動保存(入力+モードをstoryId毎にlocalStorage。送信で自動削除)
- E2E-040〜042追加。全32件green
