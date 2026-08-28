# Research: OOC — The Playable Anime (ooc.ai)

- collected: 2026-08-28
- purpose: 一次データの保管庫。解釈は `../teardown.md` 側で行う
- confidence: **high**(LP/ヘルプセンター/ストア/公式PR/Web版JSバンドルのAPIルート = 一次情報。レビュー統計 = 三次集計)

---

## 0. 一次ソース一覧

| 種別 | URL | 取得内容 |
|---|---|---|
| 公式Web | https://ooc.ai/ | SPA。`api.ooc.ai` / `cdn.ooc.ai` / `image-gen.static.ooc.ai` / `image.static.ooc.ai` |
| 公式JSバンドル | cdn.ooc.ai/assets/build-prod/static/js/*.js | **APIルート全列挙**(§3)、UI文字列、決済方式 |
| ヘルプセンター | https://help.ooc.ai/ | Story Builder 8段階 / Character Builder 5段階 / Creator Program / Content Policy |
| App Store | apps.apple.com/us/app/id6761247061 | 説明文・IAP価格・レーティング |
| Google Play | play.google.com/store/apps/details?id=com.newai.ooc | インストール数・評価 |
| 公式PR | businesswire.com 2026-04-15 | 北米ローンチ・ポジショニング・CEOコメント |
| レビュー集計 | glotier.com/games/ooc | 150件の肯定/否定内訳(三次) |
| 競合ブログ | isekaizero.ai(競合他社の記事 = **利害関係あり**、数値は参考値) | クレジット単価・無料枠 |

---

## 1. 会社・製品ライン

- 運営: **Wrtn Technologies**(韓国)。北米法人名義は **New AI Entertainment Inc.**(App Store の Seller)
- 3地域で**同一エンジンの別ブランド**を展開:
  - **Crack**(韓国・2025年4月単独ローンチ、主力収益源)
  - **キャラぷ / Kyarapu**(日本) ← 当リポジトリの旧ベンチマーク
  - **OOC**(北米・2026年4月ローンチ)
- 全プラットフォーム累計 **650万ユーザー**(社発表)
- Series C **$72M** 調達(2026年8月、Korea Times)
- 連絡先: ooc_mkt@wrtn.io / PR担当 Chris Pyo

> つまり **OOC は「キャラぷの北米版」**。旧teardownのキャラぷ分析はエンジン理解として今も有効で、
> 差分は「北米向けにどうローカライズ/再設計したか」に集約される。

## 2. ポジショニングとコピー(逐語)

- ブランドタグ: **"THE PLAYABLE ANIME"** / App Store サブタイトル **"The first interactive anime."**
- 説明文冒頭: *"Dive into an immersive adventure where you don't just read the webnovel—you step inside it. OOC is an infinite world for your imagination, creativity, and storytelling."*
- App Store 機能ブレット(逐語):
  - *"Ad-Free Immersion: Dive deep into stories with absolutely no commercial interruptions."*
  - *"Free Unlimited Chat: Chat endlessly for free (Only available using the Basic Model in Character Mode)."*
  - *"Shape Your Epic: Seamless character creation and world-building tools."*
  - *"Deep Memory: Companions that truly remember your shared history and grow with you."*
  - *"Complete Privacy Control: Keep your stories secret or publish them to the community."*
  - *"Vibrant Community: Follow favorite creators and experience user-generated masterpieces."*
- CEO Seyoung Lee: *"Users aren't just chatting with a character, they are entering a narrative world where they are the protagonist."*
- PR上の自己定義: 「AI が **Dungeon Master** として振る舞い、テキスト・画像・音声を同時生成する」「world-building / evolving plot arcs / serialized storytelling」
- 想定読者: 英語圏のアニメ・マンガ・JRPG・インタラクティブフィクション層

> **注目**: "Deep Memory" を売り文句にしながら、レビュー否定意見の23%が記憶欠落(§6)。**公約と実態の乖離が最大の攻撃面**。

## 3. APIルート全列挙(Web版JSバンドルより抽出 = 機能の実測マップ)

`api.ooc.ai` に対して呼ばれるパス。**これが OOC の機能の事実上の完全な目次**。

### 認証・アカウント
`/sign-in` `/oauth/exchange` `/token/refresh` `/logout` `/callback` `/account` `/account/unregister` `/me` `/user/extend`
- ソーシャル: **Continue with Google / Continue with Apple**(バンドル内文字列で確認。メール登録は未確認)
- 退会理由の選択肢(逐語): *"I don't use the service often"* / *"I'm concerned about privacy"* / *"There are too many ads or notifications"*
- 退会時: **残クレジットは全額失効・返金不可**、同一アカウントで **7日間** 再登録不可

### 発見・フィード
`/feeds` `/genres` `/genre-navigations/web` `/content/search` `/content/search/tag` `/search`
`/keyword/ranking` `/keyword/recent` `/keyword/recent/purge`
`/stories/ranking` `/character-rankings`
`/story-recommendations/newbie` `/story-recommendations/similar` `/story-recommendations/user-based`
`/stories/recommendations/attendance` `/stories/recommendations/newbie`
- **推薦の切り口が4系統**: 新規向け / 類似 / 行動ベース / **出席(デイリーチェックイン)連動**

### プレイ(チャット)
`/v3/chats` `/v3/chats/recent` `/v3/chats/delete` `/v3/chats/default-chat-setting`
`/v3/chat-models` `/v3/chat-models/errors`
`/character-chats` `/character-chats/contact-setting` `/character-chats/delete`
`/character-temp-chats` `/temp` `/temp-stories`
`/shortcut-commands` `/shortcut-commands/me` `/shortcut-commands/hub/search`
`/situation-images/generate` `/situation-images/status` `/situation-images/delete`
- **`/v3/chat-models`** = モデル階層をサーバ側で配信(Basic / Premium / 上位)
- **`/character-temp-chats` `/temp-stories`** = **未登録での試し打ち**が存在する(登録壁の後置き)
- **`/shortcut-commands` + `/shortcut-commands/hub/search`** = ユーザー定義のスラッシュコマンドに**共有ハブ**がある(後述 §5)
- **`/situation-images/generate` + `/status`** = 非同期のシーン画像生成(専用ドメイン `image-gen.static.ooc.ai`)

### 作成(Builder)
`/builder/` `/stories` `/story-drafts` `/story-drafts/delete-many` `/stories/validate-inputs/v2`
`/characters` `/characters/new` `/characters/draft` `/characters/drafts` `/characters/drafts/deleteMany` `/characters/validate-inputs`
`/stories/suggest/detail` `/stories/suggest/initial-message` `/stories/suggest/conversation-example` `/stories/suggest/epilogue-example` `/stories/suggest/parameter-description`
`/characters/auto-gen/prompt` `/characters/auto-gen/intro-message` `/characters/auto-gen/example-message`
`/story-starting-sets/parameter/assets` `/stories/situation-image` `/stories/profile-image`
`/my-title`
- **AI下書き支援が9エンドポイント**。作成の全項目に「AIが書く」ボタンがある設計
- `parameter-description` / `parameter/assets` = **ステータス(パラメータ)機能**のAI支援とアイコン素材
- `epilogue-example` = **エンディング文のAI生成**

### 収益・成長ループ
`/cash` `/cash/products` `/cash/history` `/cash/payment-history` `/cash/promotion-session`
`/credit` `/credit/coupon` `/coupons/use`
`/attendance` `/assignments` `/tutorials` `/tutorials/start` `/tutorials/status` `/tutorials/v2/complete`
`/v1/payments/stripe/checkout-session` `/payment/callback`
- **Web決済は Stripe 直結**(= ストア手数料15〜30%回避。北米でも定石を踏襲)
- `/attendance` = デイリーチェックイン、`/assignments` = ミッション、`/tutorials/*` = 初回チュートリアル報酬

### クリエイター
`/creators` `/creators/status` `/creators/missions/start` `/creators/missions/status` `/creators/pre-missions/status`
`/profile/creator-apply` `/profile/challenge` `/pages` `/pages/me` `/profiles` `/profiles/search` `/profiles/support`
- **`/creators/pre-missions` → `/creators/missions`** の2段階ゲート構造(実数値は §7)
- `/profiles/support` = クリエイター支援(投げ銭相当)の存在を示唆 [要確認]

### 設定・安全
`/profile/setting/my-info` `/profile/setting/chat` `/profile/setting/personalization` `/profile/setting/slash-command` `/profile/setting/block-management`
`/block` `/block/tag` `/block/clear`
`/alarm` `/alarm/check` `/notification` `/announcements` `/announcements/noti` `/announcement/`
`/onboarding` `/profiles/onboarding` `/profiles/onboarding/check`
`/policy/service.en-US.2026-01-04.md` `/policy/service.en-CA.2026-01-04.md`
`/policy/privacy.en-US.2026-01-04.md` `/policy/privacy.en-CA.2026-01-04.md`
`/maintenance` `/history` `/liked` `/characters/me/liked` `/stories/me/liked` `/stories/me/following`
- **`/block/tag` = タグ単位のブロック**(「このタグの作品を今後出さない」)。嫌悪回避の強力な発見体験
- **ポリシーが en-US と en-CA の2本のみ** → **対象市場は明確に「米国+カナダ」= 北米限定**
- UI文字列: *"Content Preference"* / *"Select the type of content you'd like to see."* / *"Policy region"* / *"United States"*

## 4. Story Builder(8段階 / help.ooc.ai 逐語ベース)

| # | 段階 | 中身 |
|---|---|---|
| 1 | Profile Settings | 作品プロフィール(表紙・タイトル等) |
| 2 | Basic Settings | **Default Prompt**(AIが広く状況を解釈)/ **Custom Prompt**(全指示をクリエイターが記述)の二択。キャラの外見・性格・口調・進行指示。**Plot Examples 最大3件**。AI Model Settings |
| 3 | Intro | **Prologue**(必須)/ **Scenario Name**(必須・25字以内)/ Opening Scene。1作品に**複数Intro**(例: School Days / College Years / After Marriage)。**Play Guide** = ユーザーにのみ見えAIは記憶しないガイド文。**Response Suggestions**(未指定ならAIが自動生成、手動なら最大3件) |
| 4 | **Stat** | 好感度/HP/戦闘力などの数値。**1 start setting あたり最大7個**、名前20字、単位6字、値域 −99,999〜99,999。**Level を最大4段**(名前20字/条件(以上・未満)/prompt 200字)。例: Affinity 0–30 "Wary" / 31–60 "Fond" / 61–100 "Lover"。**値の増減条件を自然文で記述**(例:「直撃を受けたら −8〜−12」「治療を受けたら +15〜+25」)。**stat が変わると AI の口調と振る舞いが変わる** |
| 5 | Media | **Scene Images**。**Intro あたり最大50枚**、5MB/枚、jpeg/jpg/png/webp/gif、**1:1 前提**。`{{img: ImageName}}` を Opening Message や Plot Examples に貼ると発火。画像ごとに状況説明を書くほど賢く出る |
| 6 | Keyword Book | キーワード検出で注入される Keyword Note(例: 「Freesia」→「彼女の好きな花」)。**同時アクティブは最大3件**、上にあるものが優先。全Intro適用 or 個別Intro適用 |
| 7 | **Endings** | start setting ごとにエンディング設定。**レアリティ N/R/SR/SSR**。条件は**最低10ターン以降、以後5ターンごとに判定**。条件 = 必要ターン数 + stat 条件(1ステップ最大7ルール、ドラッグ順序)。Prompt / Epilogue(**AI自動生成可**)/ Ending hint。**到達するとカードが積み上がる=コレクション**。**上位5エンディングにランキングバッジ**。stat 依存エンディングはカードに主要数値を表示 |
| 8 | Publish | 公開(Public / Link Only / Private) |

## 5. Character Builder(5段階)

| # | 段階 | 中身 |
|---|---|---|
| 1 | Character Setup | 基本プロフィール |
| 2 | Intro | 導入 |
| 3 | Prompt | 振る舞いの指示 |
| 4 | Advanced Features | **Scene Images 最大50枚**、1:1。状況説明が詳しいほど「賢く」出る |
| 5 | Character Details | Keyword Book ほか |

その他確認できた機能:
- **Premium Mode**: キャラチャットでモードを選べる。**Premium Mode は 1回20クレジット**。「より没入感と豊かな表現」
- **Credit History**: 左メニュー Credits → Credit History。**Purchase History / Usage History を分離表示**
- **Slash Commands**(`/profile/setting/slash-command` + `/shortcut-commands/hub/search`): ユーザーが定型指示を登録し、チャット内で呼び出す。**ハブで他人のコマンドを検索・入手できる** [要確認: ハブの公開範囲]

## 6. 価格・無料枠(実測 + 三次)

### IAP 価格(App Store 実測 = 一次)
| 商品 | 価格 |
|---|---|
| 1,000 Credits | $1.39 |
| 2,000 Credits | $2.89 |
| 5,000 Credits | $7.09 |
| 10,000 Credits | $14.49 |
| 20,000 Credits | $28.49 |
| 50,000 Credits | $71.00 |
| 100,000 Credits | $142.99 |
| Promotion Credit | $9.99 / $19.99 |

→ **単価はほぼ一定(約 $0.00143/credit)。まとめ買い割引が実質ない**(1,000: $0.00139 vs 100,000: $0.00143 で**むしろ大口が割高**)。ヘビーユーザーへの報酬設計が欠落。

### 消費レート(三次・競合ブログ由来 = 参考値 [要確認])
- Story Mode: 最上位モデル **〜195 credits/生成** / 中位 **〜90** / Basic **〜30**
- Character Mode: **Basic モデルは無料・無制限**(App Store説明文とも整合 = 信頼度高)
- Premium Mode(キャラチャット): **20 credits/回**(ヘルプセンター = 一次)
- 初回登録ボーナス 〜500、**デイリーチェックイン 〜300/日**、チュートリアル 1,500
- → **無料ユーザーの1日は最上位で1〜3メッセージ**。$14.49/10,000 credits なら **最上位1通あたり約 $0.28**

### サブスクリプション
- **存在しない**。クレジットパックのみ。**レビューで最も要望が多い機能**

## 7. クリエイタープログラム(help.ooc.ai 逐語 = 一次)

### Certified Creator への道(2段階ゲート)
**Phase 1 — 事前資格(全て満たす)**
- *"Total Number of Users Chatted With: 1,000 or more (Cumulative)"*(公開キャラの会話のみ計上)
- *"Public Content Count: 10 or more"*(Private / Link Only は除外)
- *"Total Followers: 500 or more"*

**Phase 2 — Creator Mission**
- *"Total Interaction Count (Chat Volume): 100,000"*(ユニークユーザーではなく**メッセージ総数**)

**除外条件**: Link only / Private への変更、ポリシー違反、**"Fan Fiction" カテゴリの作品**は計上されない

### OOC Original(収益化の本丸)
- Certified Creator のみ応募可
- 対象: **他サービスに未公開の完全新規IP**のみ。Private / Link Only 状態で、過去に一度も公開していないこと
- 報酬: **現金 $300 の一括** + **当該作品から発生した Credits の 2.0% レベニューシェア** + IP Purchase Fee
- **著作権は OOC に恒久譲渡**。以後クリエイターは削除も非公開化もできない。続編・グッズは事前協議が必要
- 特典: "OOC Original Exclusive Hall" 掲載 / 専用UI / **OOC Original Badge**
- 審査: 30日以内の2段階(ポリシー適合 → *"fun, completeness, freshness, and originality"* の定性評価)
- ジャンル・レーティング制限なし。**二次創作・派生IPは不可**

> **この条件は北米のクリエイター文化と正面衝突する**。1,000人×500フォロワー×10万インタラクションを積んで初めて応募でき、
> 通っても $300 + 2% と引き換えに**著作権を永久に手放す**。AO3/Wattpad/Patreon に慣れた層には受け入れ難い。**最大の突き所**。

## 8. コンテンツポリシー(help.ooc.ai 逐語要約 = 一次)

- 二層構造: **General Content(全年齢)** と **Adult Content(認証済みユーザーのみ)**
  - General: **性的表現は一切不可**(行為・示唆・性的な言い回し・身体部位/器具への言及すべて)
  - Adult: 認証済みに開放。ただし**性犯罪・獣姦・近親相姦・非同意**の猥褻描写は不可。体液/排泄物の性的化も不可。一般的な悪態はキャラ表現として可
- 暴力: General は殺人・暴行・拷問の描写を全面禁止。Adult は物語上必要な範囲で残酷描写を限定的に許容(過度な残虐の賛美は不可)
- **未成年**: 若い外見・幼い口調・学校/制服の文脈で「未成年に見える」キャラは性的文脈に一切登場させられない
- **実在人物**: 同意なき顔・画像・識別可能情報の使用禁止。実写に見えるプロフィール画像も制限
- **IP/二次創作**: 原著作者のガイドラインに反する二次創作は禁止(=**建前は禁止**。ただし §7 に "Fan Fiction" **カテゴリが存在する**という矛盾 [要確認])
- 執行: 能動監視 + 通報。再分類 / 非公開化 / BAN。**法執行機関への通報を単独裁量で行いうる**

> **矛盾点**: App Store レーティングは **13+** なのに Adult Content 層を持つ。
> Web のみ開放 / 特定地域限定 / ストア審査上のグレー運用のいずれか [要確認]。**北米の規制強化局面(§ na-market.md)で構造的リスク**。

## 9. 市場での実績と評判

### 数値
| 指標 | 値 | 出典 |
|---|---|---|
| Google Play 評価 | **4.19★ / 15,000+ reviews** | glotier(2026-08) |
| Google Play インストール | **500,000+** | glotier |
| App Store 評価 | **4.6★ / 3,800 ratings** | App Store(一次) |
| 米国 Google Play ランキング | **Simulation カテゴリ 売上6位** | glotier |
| App Store カテゴリ / レーティング | Entertainment / **13+** / 141MB / **英語のみ** | App Store(一次) |
| 更新頻度 | v0.1.17、直近更新1日前 | App Store(一次) |

> **ローンチ4ヶ月で米国 Simulation 売上6位**。北米で数字を出している=市場は実在する。
> 一方で **v0.1.x** のまま。プロダクトとしては未成熟であることを自認するバージョニング。

### レビュー内訳(150件分析 / glotier = 三次)
**肯定(64件)**: 中毒性 17% / *"high quality storytelling"* 16% / AI の応答性 14% / 没入感 11% / 創作の自由度 9% / 作り込み 8%

**否定(61件)**:
| 順位 | 内容 | 比率 |
|---|---|---|
| 1 | **"expensive credits system"** | **36%**(22件) |
| 2 | **AI の記憶欠落** | **23%** |
| 3 | 無料クレジットが少ない | 18% |
| 4 | **"aggressive monetization"** | 15% |
| 5 | バグ・機能の破損 | 12% |
| 6 | AI 挙動の一貫性のなさ | 10% |
| 7 | デバイス互換性 | 5% |
| 8 | セーフティフィルタへの不満 | 4% |

→ **1・3・4を合算すると否定意見の約69%が「金の問題」、23%が「記憶の問題」**。この2つで実質すべて。

### App Store レビュー(逐語抜粋)
- *"Love this app so far its alot more fun than i originally thought"*(肯定)
- *"I love anime and I love Dungeons & Dragons and just role-playing games"* ★5 — **TRPG的な期待で来ている**
- *"It's ALMOST perfect"* ★4 — *"I've put so many hours into this AI"*
- *"Good app, here's my issues"* — *"The credit thing is fine seems fair for what they are offering"*(**価格を許容する層も一定数いる**)
- *"OOC is good, just some parts needs fixing"*

### 具体的な不具合報告(レビュー由来)
- ランダムなログアウト
- **ストーリー編集・クリエイター機能で黒画面**
- 画像のロード失敗
- **User Notes のテキスト入力が壊れる / 入力内容が見えない**
- 長時間セッションで**明示的に記憶させた固有名詞や設定を忘れる** → 直前の展開を繰り返す、確定事実と矛盾する
- **忘れた設定を教え直すのにまたクレジットを消費する**(= 二重の罰)

## 10. 競合ブログ由来の記述 [要確認 / 利害関係あり]

isekaizero.ai(競合サービスの自社ブログ)は以下を主張。**一次確認できていない**ので teardown では参考扱い:
- *"Memory is session-based (resets between conversations)"*
- *"Available on iOS and Android only"* ← **誤り**。ooc.ai は Web で動作しアカウント同期する(同ブログ内の別記事とも矛盾)
- *"No creator earnings program"* ← **誤り**。§7 の通り存在する
→ 競合ブログの事実主張は信用しない。**数値(195/90/30 credits, 300/day)のみ参考値として採用**。

---

## Appendix: 未確認事項 [要確認]

1. Adult Content 層は Web 限定か。App Store 13+ との整合をどう取っているか
2. `/shortcut-commands/hub/search` の公開範囲。他人のスラッシュコマンドをどこまで入手できるか
3. `/profiles/support` は投げ銭か、単なる問い合わせか
4. Character Mode の Basic 無料無制限に隠れたレート制限はあるか
5. `/v3/chat-models` が返すモデル階層の正確な名称・価格・コンテキスト長
6. ポリシーが二次創作を禁じているのに Creator Mission に "Fan Fiction" カテゴリ除外規定がある矛盾の実態
7. Story Mode の音声生成。PRは「テキスト・画像・音声を同時生成」と述べるが、ヘルプ・ストア説明文・APIルートに音声の痕跡がない
8. DAU / 課金率 / ARPPU。非公開
9. `/assignments` の具体的なミッション内容と報酬額
