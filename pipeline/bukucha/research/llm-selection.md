# LLM調達調査（2026年8月時点）

> 調査日: 2026-08-06 / 一次情報（各社公式ポリシー・料金ページ・API）を優先。取得できなかったものは `[要一次確認]`。推定は `[推定]`。
> 用途: 女性向けノベル型AIチャット（日本語の地の文+「」セリフ、1応答300〜600字、世界観+キャラ設定+履歴20往復+要約）

---

## 0. エグゼクティブサマリ

1. **Phase 1（R15寸止め）は、単価とレイテンシだけで選んでよい。** 「寸止め」は主要各社が禁じる "sexually explicit content" に該当しない。この段階の制約は規約ではなくモデルの**過剰拒否（refusal）**。
2. **Phase 2（Web版R18）が本当の制約。** 大手API（OpenAI / Google / Anthropic / DeepSeek公式 / Together / Novita）は**全滅**。生き残るのは ① **Mistral La Plateforme**（2026/6/11改訂で性的領域の禁止がCSAM・NCIIのみに縮小）② **オープンウェイトを規約の緩いホストで動かす**（DeepInfra / Featherless / Venice）③ **xAI Grok**（テキストのフィクションは禁止列挙に無い）の3本。
3. **原価は「出力単価×キャッシュ」でほぼ決まる。** 1ターン（system 2,000 + 履歴 3,000 + 出力 400）はキャッシュ有りで **0.015〜0.13円**。この帯なら「会話無制限無料+広告」（Zeta型）が構造的に成立する。
4. **日本語品質のコスパ最良は中国系オープンモデル**（Qwen系）。CJK漢字共有による構造的優位がNejumi 4で実証。ただし**中国語混入**という固有リスクがある。
5. **推奨は3層マルチプロバイダ**（§7）。単一プロバイダ依存は規約変更リスクに対して致命的。

---

## 1. NSFW許容ポリシーの実態（最重要）

| プロバイダ | 性的コンテンツの扱い | R15 | R18 | 根拠 |
|---|---|---|---|---|
| **OpenAI API** | 成人向けモード**無期限凍結**（2026/3/26） | ○ | **×** | 二次 |
| **Google Gemini / Vertex** | Prohibited Use Policy が "Sexually explicit content" を明示禁止 | ○ | **×** | [一次](https://policies.google.com/terms/generative-ai/use-policy) |
| **Anthropic Claude** | "Do Not Generate Sexually Explicit Content" セクションで明示禁止 | △（拒否傾向強） | **×** | Usage Policy 2025/9/15 |
| **xAI Grok** | AUPは実在人物ポルノ・nudify・CSAMを禁止。**架空キャラのテキスト性的描写は禁止列挙に無い** | ◎ | **○（最有力の大手）** `[要一次確認]` | 二次（x.aiは403で一次取得不可） |
| **DeepSeek 公式** | 規約が "pornographic... **(e.g., sexual chatbots)**" を明示禁止。**当社用途を名指し** | △ | **×** | [一次](https://cdn.deepseek.com/policies/en-US/deepseek-terms-of-use.html) |
| **Mistral La Plateforme** | 2026/6/11更新。成人向けの**包括禁止が無い**。性的領域はCSAM・NCIIのみ | ◎ | **○** | [一次](https://legal.mistral.ai/terms/usage-policy) |
| **Together AI** | ToS が "obscene, or constitutes pornography" を禁止 | ○ | **×** | 二次 |
| **Novita AI** | ToS が "pornography or graphic adult content" を禁止。違反は永久BAN | ○ | **×** | [一次](https://novita.ai/legal/terms-of-service) |
| **DeepInfra** | ToSに性的コンテンツの明示制限が**無い**。モデル側ライセンスに委ねる | ◎ | **○** | [一次](https://deepinfra.com/terms) |
| **Featherless AI** | 性的制限**無し**。"Uncensored / Abliterated Models" を公式カテゴリとして提供 | ◎ | **◎** | [一次](https://featherless.ai/terms) |
| **Venice AI** | 無検閲を設計思想として明示。ZDR / TEE / E2EE推論 | ◎ | **◎** | 二次 |
| **OpenRouter** | **ToSに性的コンテンツの禁止条項が一切無い。** 禁止は「違法目的」と「適用されるModel Termsへの違反」のみ | ◎ | **モデル依存** | [一次](https://openrouter.ai/terms)（全文精査済） |

### 重要な読み解き

**OpenAI — 「解禁報道」の顛末**
2025/10 Altman が "erotica coming to ChatGPT" と発言 → 12月に usage policies 改訂 → **2026/3/26 に無期限凍結**（安全性懸念、年齢予測の誤判定率〜12%）。API側の制限は一貫して維持。年齢予測は2026年1月から稼働し、未成年と推定されたアカウントからロマンス/性的RPが静かに剥奪される。
→ **OpenAIをR18の受け皿として計画に織り込むのは不可。**

**Google — ポリシーと実装が乖離**
Gemini APIの safety settings は `HARM_CATEGORY_SEXUALLY_EXPLICIT` を含む4カテゴリが調整可能で、しきい値に `OFF`/`BLOCK_NONE` が存在。**Gemini 2.5/3系のデフォルトは `OFF`**。ただしドキュメントは「緩いセーフティ設定は利用規約に基づくレビュー対象になりうる」と明記。
→ **実装上は出せるが規約上は禁止。R15には極めて使いやすいが、R18本番の土台にはできない。**

**Mistral — 2026年最大のポリシー変化**
2026/6/11更新のUsage Policyで、性的領域の禁止は CSAM（ゼロトレランス）と NCII（同意なき親密画像）の2点のみ。**成人向け・エロチカ・ポルノの包括禁止条項が存在しない。** 積極的許可ではないグレーだが、明文禁止がある他社とは決定的に立場が違う。同ポリシーは「オープンソースモデルには適用されない」とも明記。
→ **オリジナル作品限定の当社用途なら規約上ほぼクリア。**

**中国系APIの構造的制約**
DeepSeek / Alibaba(Qwen) / Zhipu(GLM) / MiniMax / Moonshot(Kimi) はいずれも中国法（ポルノ禁止）下でR18不可。**ただしオープンウェイトを DeepInfra / Featherless / Venice など西側ホストで動かせばこの制約は及ばない。** OpenRouterのエンドポイントAPIで確認したところ DeepSeek V4 Flash は20社が提供しており、オープンウェイトである蓋然性が高い `[推定・高確度]`。**プロバイダ指定ルーティングが必須の運用テクニック。**

### ロールプレイ特化ホスティング

| サービス | 課金 | 規約 | 評価 |
|---|---|---|---|
| Featherless AI | 定額（Basic $10 / Chat $25 で無制限トークン・4並列） | 性的制限なし | **並列数が課金の実体** = スケール時のボトルネック |
| Infermatic / Arli AI | 定額 | `[要一次確認]` | Novelcrafter等が公式接続先に採用 |
| Venice AI | Free / Pro (~$18/mo) | 無検閲を設計思想に明示 | プライバシー主張は**外部監査不能** |

→ 定額系は「1ユーザー分の推論枠」を買う設計なので、コンシューマのバックエンドには構造的に合わない。**R18の避難先は DeepInfra（従量・規約が緩い）が本命**、Featherless/Venice は補助。

---

## 2. 単価比較（USD / 100万トークン）

### 2-1. 日本語トークン効率（本調査で実測）

女性向けノベル文体サンプル（219文字）を実トークナイザに通した結果:

| トークナイザ / モデル系 | 1トークンあたり文字数 | 500字 = 何トークン |
|---|---|---|
| **Qwen3 / Qwen2.5** | **1.386** | **361** |
| DeepSeek-V3系 | 1.327 | 377 |
| Mistral Nemo | 1.311 | 381 |
| GLM-4.5系 | 1.223 | 409 |
| o200k_base（GPT-5系 / gpt-oss） | 1.184 | 422 |
| cl100k_base（旧GPT） | 0.869 | 575 |
| Gemini系 | 〜1.3–1.5 `[推定]` | 335–385 |
| Claude Sonnet 4.5 | 1.02 | 490 |
| **Claude Opus 4.7以降 / Opus 5** | **〜0.78** `[推定]` | **〜640** |
| PLaMo 2.1 Prime | 1.85 | 270 |

**重大な注意点:**
1. **Claude 4.7以降は新トークナイザで「同じテキストに約30%多くトークンを生成する」** と Anthropic 公式が明記。**日本語の実質単価は表示価格の1.3倍で見積もる必要がある。**（[一次](https://platform.claude.com/docs/en/about-claude/pricing)）
2. 出力400トークンは Qwen系で約554字、DeepSeek系で531字、GPT系で474字。**「1応答300〜600字」にきれいに収まる。** ただしClaude Opusでは約310字にしかならない。

### 2-2. 主要候補（`in / cached-read / out`、NSFW欄はR18テキストの規約上の可否）

#### 超低価格帯

| モデル | in | cached | out | R18 | 日本語 | キャッシュ |
|---|---|---|---|---|---|---|
| **Ling 2.6 Flash** | 0.010 | 0.002 | 0.030 | プロバイダ次第 | 未検証 | ○ |
| **Qwen3.7 Flash** | 0.030 | 0.006 | **0.130** | 西側ホストなら○ | **高** | ○ |
| gpt-oss-120b | 0.037 | — | 0.170 | Apache-2.0、ホスト次第 | 中〜高 | × |
| sao10k/l3-lunaris-8b（RP特化） | 0.040 | — | 0.050 | ○ | **低**（英語特化） | × |
| **GLM-4.7-Flash** | 0.060 | 0.010 | 0.400 | 西側ホストなら○ | 高 | ○ |
| Gemma 4 26B-A4B | 0.070 | — | 0.340 | ホスト次第 | 高 | × |
| **DeepSeek V4 Flash**（OR最安経路） | 0.084 | 0.018 | 0.168 | 西側ホストなら○ | 中（直訳感の評あり） | ○ |
| DeepSeek V4 Flash（公式） | 0.140 | **0.0028** | 0.280 | **×** | 中 | ◎（50倍差） |
| Mistral Small 3.2 24B | 0.094 | — | 0.250 | **○** | 中 | × |
| **Gemini 2.5 Flash-Lite** | 0.100 | 0.010 | 0.400 | **×** | **高** | ○ |

#### 中価格帯

| モデル | in | cached | out | R18 | 日本語 |
|---|---|---|---|---|---|
| **Qwen3.5-27B** | 0.195 | — | 1.560 | ホスト次第 | **高**（Nejumi4 開放4位） |
| **MiniMax M2-her**（RP特化） | 0.300 | 0.030 | 1.200 | MiniMax直のみ→× | **要検証** |
| **Gemini 3.1 Flash-Lite** | 0.250 | 0.025 | 1.500 | **×** | **高** |
| cydonia-24b-v4.1（RP特化） | 0.300 | — | 0.500 | **○** | **低**（英語RP特化） |
| **Qwen3.5-397B-A17B** | 0.390 | — | 2.340 | ホスト次第 | **最高**（Nejumi4 開放1位） |
| Mistral Medium 3.1 | 0.400 | 0.040 | 2.000 | **○** | 中 |
| GLM-4.7 | 0.400 | 0.080 | 1.750 | ホスト次第 | 高 |

#### 高価格帯

| モデル | in | cached | out | R18 | 日本語 |
|---|---|---|---|---|---|
| **Grok 4.20 / 4.3** | 1.250 | 0.200 | 2.500 | **○（最有力）** | 高（1M〜2Mコンテキスト） |
| **Claude Haiku 4.5** | 1.000 | 0.100 | 5.000 | **×** | 高（トークン効率悪） |
| Gemini 3.1 Pro | 2.000 | 0.200 | 12.000 | × | Nejumi4 総合3位 |
| Claude Opus 5 / 4.8 | 5.000 | 0.500 | 25.000 | × | **Nejumi4 総合1位** |

出典: [DeepSeek](https://api-docs.deepseek.com/quick_start/pricing) / [Gemini](https://ai.google.dev/gemini-api/docs/pricing) / [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing) / [xAI](https://docs.x.ai/docs/models) / OpenRouter `/api/v1/models`（340モデル全数解析）

### 2-3. 日本語特化モデル

| モデル | API | 価格 | ライセンス | 評価 |
|---|---|---|---|---|
| **PLaMo 3.0 Prime**（PFN） | ○ 商用GA | **¥60/M入力・¥250/M出力** | 商用API | **日本語トークン効率が圧倒的**（1.85字/token）。補正すると実質 Gemini 3.1 Flash-Lite 級。256Kコンテキスト |
| Sarashina（SB Intuitions） | △ 法人向け。2026/6/16に新規受付終了 | 非公開 | 法人契約 | **調達難易度が高くスタートアップ向きでない** |
| **GPT-OSS Swallow 120B / 20B**（東工大+産総研） | × セルフホストのみ | 無料 | **Apache-2.0** | **Japanese MT-Bench 0.916 で GPT-5.1 Thinking (0.897) を上回る**。2026/2/20公開 |
| RakutenAI-3.0 / llm-jp-4 / CyberAgentLM / ELYZA | 一部 | — | 多くはオープン | 2026年時点で Qwen/Gemma 系にスコアで抜かれている |

> **戦略的示唆:** GPT-OSS Swallow 120B は **Apache-2.0 で日本語MT-Benchトップクラス**。R18の逃がし先として「自社FT → DeepInfra等でセルフホスト」が日本語品質を犠牲にせず成立する。**規約リスクに対する最強の保険。**

---

## 3. 日本語ロールプレイ品質

### Nejumi Leaderboard 4（2026/7/10版）

**商用API 総合TOP5**: Claude Opus 4.8 (0.8523) / Opus 4.7 (0.8509) / Gemini 3.1 Pro (0.8430) / GPT-5.5 (0.8411) / GPT-5.4 (0.8397)

**オープンモデル TOP5**: Qwen3.5-397B-A17B (0.8191) / Qwen3.5-122B-A10B (0.8094) / Gemma 4 31B (0.8077) / **Qwen3.5-27B (0.8049)** / Qwen3.5-35B-A3B (0.7895)

### ベンチマークが示す構造的事実

1. **中国系モデルのCJK構造的優位。** 共有漢字がQwen等に構造的優位を与える。**ただし Qwen2.5-7B は日本語出力に0.9%の確率で中国語が混入する。** ノベル生成では致命的な没入破壊 → **出力後の中国語文字検出フィルタが必須。**
2. **「流暢な日本語生成」と「日本語の深い知識」は別能力。** GPT-OSS Swallow 120B が Japanese MT-Bench で GPT-5.1 Thinking を上回る一方、Nejumi 4 総合では上位50に日本語特化モデルが1つも入らない。**ノベル生成に効くのは前者。総合スコアで選ぶと判断を誤る。**
3. **敬語の適切性・文脈依存解釈・省略処理を体系的に評価するベンチマークは存在しない。** 女性向けノベルで最も効くのはまさにこの領域 → **社内で独自評価セットを組むしかない。**

### コミュニティ評価（定性）

- **Gemini**: 日本語の自然さ・敬語のニュアンスで一歩リード。長文コンテキスト処理が抜群。Author's Note のような指示に極めて敏感
- **Claude**: 自然で読みやすい日本語。ただし**トークン効率が最悪**でコスト要件と正面衝突
- **DeepSeek**: 「日本語の表現がちょっと不自然。直訳感。読点の使い方が変」が複数 → **地の文の質感が問われる用途では要注意**
- **Grok**: 官能小説を追加設定なしで書く「自由派」。日本語実測記事で1位評価
- **Qwen3系**: 「日本語ローカルLLMで最も信頼できる」

**AIのべりすと（Bit192）**: 完全自社モデル。**「書き味」でモデルを分ける**発想（【カラフル】=奔放 /【ソリッド】=堅実）は当社UXに流用できる示唆（Zetaの zeta/koji/luca と同型）。

---

## 4. 競合が何を使っているか

### Zeta（Scatter Lab）— 最重要ベンチマーク
- **自社SLM「PingPong-1」→「Spotwrite-1」**。「推論コスト削減のため内製」「一貫性でなく**"面白さ"に最適化** — 創造性・予測不能性・制御されたハルシネーションを活用」と明言
- **推論インフラ: FriendliAI Container** で月10億インタラクション超。CEO曰く「**損益分岐点到達に貢献した**」
- **GPU: Runpod** でマルチリージョン。**1,000+ req/sec**、数百GPU 24/7、**主要クラウド比 約50%のコスト削減**
- Karmada をマルチクラスタ管理に採用。2024年Q4以降6四半期連続黒字

> **示唆**: Zetaの優位は「自社モデル × 自社推論最適化 × 格安GPU」の三段構え。外部API依存では同じ価格設計はできないが、**キャッシュ+超低単価モデルで 0.015〜0.04円/ターン に到達でき、広告モデルの成立ラインには乗る。**

### Character.AI — 推論最適化の技術詳細
Multi-Query Attention、cross-layer KV-sharing、hybrid attention horizons、**int8量子化**でKVキャッシュ削減。warp-specializationによるdequantizationのattention融合。MQA向けquery head並列化で**大バッチのデコード最大9.3倍**。prefill +10%、decoding +30%。ピーク763 TFLOPs/s。

### MiniMax — RP専用モデル
**MiniMax M2-her**（2026/1）= **Talkie と 星野の実ユーザーインタラクション3年分以上で学習**したロールプレイ専用モデル。$0.30/$1.20。**プロバイダはMiniMax直のみ**→中国法の制約下でR18不可。

### キャラぷ（Wrtn）
OpenAI / Claude / Gemini 等とパートナーシップ、用途別に最適モデルを切替。過去記事で GPT-4o、Claude 3、SD3 の採用言及。**どのモデルをどのプランに割り当てているかの公式開示は無い** `[要一次確認]`。

### FANZAキャラチャット参加事業者
Babechat: **AIモデル5段階選択**、30〜350pt/通、**デフォルトがPremiumで気づかず高消費**という問題。
> **示唆**: 30pt≒30円/通の最下層でも原価0.03〜0.5円に対して**粗利率99%超**。**モデル階層課金は原価連動でなく体感価値の差別化装置**として設計されている。

### Chub AI / Janitor AI（海外RP最大手）
Janitor AI の自社JLLM は 2026/4/20 のアーキテクチャ変更で**ループ傾向がアーキテクチャに組み込まれ、パラメータ調整だけでは解決不能**と開発者が公表。
> **示唆**: 「無制限定額」を成立させるには自社モデルか定額ホストが必要。従量APIで無制限を出すなら **キャッシュ + 超低単価 + 1日上限**の三点セット。

---

## 5. プロンプト設計・チューニングの実務

### 5-1. 構造（キャッシュ最大化を前提にした並び）

```
[System / cache_control 境界 ①]  ← 毎ターン不変・キャッシュ対象
  1. 出力契約（文体・長さ・禁止事項）
  2. 世界観（シチュエーション定義）
  3. キャラ設定（description / personality / scenario）
  4. few-shot例文（地の文+セリフのお手本 2〜3往復）
[/境界 ①]
[要約 / rolling summary]          ← 数ターンに1回だけ更新 → 境界②
[/境界 ②]
[会話履歴 直近N往復]               ← 追記のみ = プレフィックスキャッシュが効く
[Author's Note]                   ← 履歴の末尾近く（深さ2〜4）
[ユーザー最新入力]
[Assistant prefill]               ← 「地の文の書き出し1文字」など
```

**原則:**
- **不変ブロックを必ず前に、可変ブロックを後ろに**（DeepSeek公式も明示推奨。キャッシュ最大化の絶対条件）
- **Author's Note は末尾近くに置く**（モデルが必ず見る。Gemini 2.5系に極めて効く）
- **キャラカードは1,500トークン以内に収める**（詰め込みすぎが2026年最頻のミス。全単語がアテンションを奪い合う）
- **Lorebook/World Info はキャッシュ境界を壊すので、要約ブロックより後ろに**

### 5-2. 日本語「地の文＋セリフ」を安定させる技法（効く順）

1. **few-shot例文が圧倒的に効く。** 文体指定を100行書くより理想の出力を2往復貼るほうが安定。**キャッシュ対象なので原価はほぼゼロ**
2. **Assistant prefill。** 「私は」「——」など地の文の開始文字をprefillすると、セリフ始まりの崩れや前置き（「わかりました、では…」）を構造的に殺せる。**Anthropic / Mistral / DeepSeek / 多くのOSSホストで利用可。Geminiは非対応** `[要確認]`
3. **長さ制御は「文字数」でなく「段落数×文の数」で指定。** LLMは日本語の文字数を数えられない。「地の文2〜3段落、セリフ2〜4個」＋`max_tokens`でハードキャップ
4. **stop sequences で暴走を止める**: `"\nユーザー:"`, `"\n【"`, `"\n---"` 等。**ユーザーの発言を勝手に代弁する**（RP最大の没入破壊）は機械的に潰すのが最確実
5. **禁止事項はネガティブでなくポジティブに書く**

### 5-3. サンプリングパラメータ

| パラメータ | 推奨値 | 備考 |
|---|---|---|
| temperature | **0.85〜0.95** | 1.0超は日本語崩れが出やすい |
| top_p | 0.9〜0.95 | temperatureと併用時は片方固定 |
| min_p | 0.03〜0.05 | 対応ホストなら top_p より安定 |
| repetition_penalty | **1.05〜1.15** | 1.2超は日本語で助詞が壊れる。**日本語は同じ助詞が高頻度で出るため英語より低めに** |
| max_tokens | 400〜550 | トークナイザ別換算で調整 |

### 5-4. 繰り返し・ループ・キャラ崩壊

**パラメータだけでは解けない。** 多層防御:
1. **サーバー側でn-gram重複検出→自動リロール**（直近3応答と4-gram以上が一定率一致したら破棄）。**小型モデルで最も効く。原価が安いからこそ成立する戦術**
2. **要約更新時にキャラ設定を再注入。** Author's Note に「【現在の○○の状態: 〜】」を毎ターン更新
3. **Chat Break（章切り）をUXに組み込む。** ノベル型なら**「章」という自然なUI概念**として実装できる — 当社の強み
4. 再生成時のみ temperature +0.1

### 5-5. コンテキスト管理

2026年のコンセンサスは**二層アーキテクチャ**（短期=コンテキストウィンドウ + 長期=RAG）。
- Memory Graph 方式は LongMemEval で 85.4%精度・300ms未満
- 「**感情的に印象的な記憶を優先し、会話の大部分を忘れる**ほうがユーザー満足度が有意に上がる」— **全部覚えるのが正解ではない**

**当社への推奨**: `直近8〜10往復を生 + それ以前を rolling summary（300〜500トークン）+ 重要イベントをキーバリュー別枠`。RAGはPhase 3。

### 5-6. プロンプトキャッシュ（原価の急所）

| プロバイダ | 最小トークン | TTL | 書込 | 読込 |
|---|---|---|---|---|
| **OpenAI** | 1,024 | 5〜10分（gpt-5.5+は既定24時間・無料） | 無料 | **10%** |
| **Anthropic** | Fable5: 512 / Opus4.8・Sonnet4.6: 1,024 / **Haiku4.5: 4,096** | 5分既定 / 1時間（2倍課金） | 1.25×（5分）/ 2×（1時間） | **10%** |
| **Google Gemini** | 3.5Flash/3.1Pro: 4,096 / 2.5系: 2,048 | 暗黙: 制御不可 / 明示: 1時間 | 暗黙: 無料 / 明示: **保存料 $1.00/M/時** | **10%** |
| **DeepSeek** | 完全自動 | — | 無料 | **V4 Flash: 2%（98%引き）/ V4 Pro: 0.83%（99%引き）** |
| **OpenRouter経由OSS** | プロバイダ依存 | — | — | **多くの安価OSSモデルは割引なし** |

**ロールプレイでの効き方**: 会話は「不変system + 追記される履歴」という理想的なプレフィックス構造なので、**毎ターン入力の85〜95%がキャッシュヒット** → **50〜77%の原価削減**。

**注意:**
- **Haiku 4.5 は最小キャッシュ単位が4,096トークン** → system 2,000では**キャッシュが効かない**。使うなら few-shot を増やして4,096以上に膨らませるほうが安くなるという逆説
- **Gemini の明示キャッシュは時間課金**なので、アイドルの長いチャットでは**暗黙キャッシュのほうが安い**

### 5-7. ファインチューニングの閾値

| 症状 | 対処 |
|---|---|
| 文体が安定しない | **まず few-shot を増やす**（3→5往復）。FT不要 |
| 特定の言い回し・世界観語彙を覚えない | Lorebook / World Info。FT不要 |
| **few-shotを増やしてもR15/R18の表現粒度が安定しない** | **FT検討ライン** |
| **プロンプトが4,000トークン超でも品質が出ない** | **FT検討ライン**（FTでプロンプトを1/4に圧縮できれば原価も下がる） |
| 規約リスクで大手APIから撤退が必要 | **FT + セルフホストが唯一解** |

**2026年のゴールデンスタンダード**: `QLoRA + DoRA + Unsloth + r=16 + target_modules="all-linear" + lr=2e-4`
- **必要データ量** `[推定]`: 日本語RPの文体固定なら **500〜2,000往復の高品質対話**で明確な効果。10,000往復でほぼ収束
- **ベース候補**: **GPT-OSS Swallow 20B（Apache-2.0）**が最有力
- **コスト** `[推定]`: 20BクラスのQLoRAなら A100×1 を10〜30時間 ≒ **$20〜$100**。**データ作成のほうが遥かに高い**

---

## 6. 運用上の論点

### 6-1. レイテンシ（TTFT）

| プロバイダ / モデル | TTFT中央値 | スループット |
|---|---|---|
| **Groq**（LPU） | **120ms** | 330 tok/s（70B）、750+（8B） |
| Fireworks | 180ms | — |
| **Gemini 2.5 Flash-Lite** | **350ms** | **213.5 tok/s** |
| GPT-4o mini / Claude Haiku 3.5 | 250〜350ms | ~160 tok/s |
| **DeepSeek** | **300ms だが P95 が 2,500ms** | — |

> **ロールプレイでは P95 が全て。** DeepSeekは中央値は良いが**テールレイテンシが極端に悪い**。20回に1回が2.5秒待ちだと没入が崩れる。**主力に置くならタイムアウト→別プロバイダのフォールバック必須。**
> ストリーミングは全社対応。**体感を決めるのはTTFTのみ。**

### 6-2. データの学習利用・ゼロデータ保持

| プロバイダ | 既定 | ZDR |
|---|---|---|
| OpenAI API | 学習に**不使用**。ログ30日 | 資格組織にZDR |
| Anthropic | 学習に**不使用**。**2025/9/14からログ保持30日→7日** | エンタープライズ契約 |
| Google Vertex AI | 契約上、学習に不使用 | **顧客が明示設定する必要あり**。既定は24時間保存 |
| **Gemini API（AI Studio無料枠）** | **学習に使われる可能性あり** | **本番では絶対に使わない** |
| DeepSeek 公式 | 中国サーバ。ログの扱いに懸念 | — |
| OpenRouter | 「学習するプロバイダにルーティングしない」トグルあり | 手動除外 |

> **当社要件（女性向けセンシティブ会話）ではログの学習利用は絶対に避ける。** 特に無料枠Gemini API と DeepSeek公式API は本番禁止。

### 6-3. 規約変更リスク

**歴史的事実:**
- OpenAI: 2025/10解禁宣言 → 12月ポリシー改訂 → **2026/3無期限凍結（5ヶ月で180度転換）**
- xAI: 2026/1の炎上から5日で画像生成を有料限定化、さらに5日後に実在人物コンテンツを全面規制
- Mistral: 2026/6/11に**緩める**方向で改訂

→ **規約は年単位ではなく四半期単位で動く。**

**必須の設計対策:**
1. **LLM抽象化レイヤ**（実装済み）。プロバイダ固有機能（prefill / cache_control / safety_settings）を吸収
2. **モデル差し替えの実運用テストを四半期ごとに**（「切り替えられる」と「切り替えたことがある」は別物）
3. **プロンプトのモデル非依存化**
4. **最終保険としてのセルフホスト経路**（GPT-OSS Swallow）
5. **プロバイダ規約の週次diff監視**

---

## 7. 推奨構成（3層マルチプロバイダ）

### 層1: 標準モデル（無制限無料 / 広告層）— 原価最優先

- **第一候補: `Gemini 2.5 Flash-Lite`（Vertex AI / 東京リージョン）** `[Phase 1の推奨]`
  $0.100 / $0.400、キャッシュ $0.010。**TTFT 350ms = 体感最速級**、日本語の自然さで定評。**SLA・ZDR・東京リージョンが揃う唯一の選択肢**。キャッシュ有りで **0.040円/ターン**。R18不可だがPhase 1では総合最良
- **第二候補: `Qwen3.7 Flash`（OpenRouter、西側プロバイダ指定）**
  $0.030 / $0.130。**日本語トークン効率が全モデル中最良**（500字=361トークン）。キャッシュ有りで **0.015円/ターン**。中国語混入フィルタ必須
- 第三候補: `GLM-4.7-Flash`（DeepInfra）$0.060/$0.400
- 第四候補: `Ling 2.6 Flash` $0.010/$0.030 — 最安（0.004円/ターン）。品質未検証

### 層2: 高品質モデル（課金消費層）

- **第一候補: `Gemini 3.1 Flash-Lite`** $0.25/$1.50 → **0.13円/ターン**
- **第二候補: `MiniMax M2-her`** $0.30/$1.20 → 0.12円/ターン。**Talkie/星野の実会話3年分で学習した唯一のRP専用大規模モデル。日本語RP性能は未検証 — 最優先で社内評価すべき**
- 第三候補: `Qwen3.5-397B-A17B` $0.39/$2.34 — Nejumi4 開放1位
- 第四候補: `Grok 4.20` $1.25/$2.50 → 0.39円/ターン — **2Mコンテキスト + R18も通る唯一の高品質大手**

### 層3: R18（Web版）の逃がし先

- **第一候補: `DeepInfra` 上のオープンウェイト**（Qwen3.5系 / GLM系 / DeepSeek V4 Flash）
  ToSに性的制限が無い。従量課金でスケール。単価は層1と同等。**本命。層1のモデルをそのまま、プロバイダだけ差し替えれば済む設計にする**
- **第二候補: `Mistral La Plateforme`**
  **規約上、性的領域の禁止がCSAMとNCIIのみという唯一の主要ラボ。**「大手ラボの直接契約でR18が通る」という**コンプライアンス上の価値**が大きい。日本語品質は中程度が難点
- **第三候補: `xAI Grok 4.20 / 4.3`** — **一次ポリシーの自己確認が必須**
- **最終保険: GPT-OSS Swallow 20B/120B（Apache-2.0）を自社FT → Runpod/DeepInfraでセルフホスト**

### 併走
- **フェイルオーバー**: OpenRouter を全層の予備経路に常時接続（学習許可プロバイダはOFF）
- **モデレーション**: `nvidia/nemotron-3.5-content-safety`（OpenRouterで**無料**）を出力後フィルタに

---

## 8. 1ターンあたり原価の試算

**前提**: system 2,000 + 履歴 3,000 = 入力5,000 tok / 出力400 tok。キャッシュ有りは4,500ヒット・500新規。$1=¥155 `[推定]`

| モデル | キャッシュ無 | キャッシュ有 | 削減率 |
|---|---:|---:|---:|
| **Ling 2.6 Flash** | 0.010円 | **0.004円** | 58% |
| **Qwen3.7 Flash** | 0.031円 | **0.015円** | 54% |
| **DeepSeek V4 Flash（OR最安）** | 0.076円 | 0.029円 | 61% |
| DeepSeek V4 Flash（公式） | 0.126円 | 0.030円 | **76%** |
| **GLM-4.7-Flash** | 0.071円 | 0.036円 | 49% |
| **Gemini 2.5 Flash-Lite** | 0.102円 | **0.040円** | 61% |
| GPT-5.6 Luna | 0.115円 | 0.052円 | 55% |
| DeepSeek V4 Pro（公式） | 0.391円 | 0.090円 | **77%** |
| **MiniMax M2-her** | 0.307円 | **0.119円** | 61% |
| **Gemini 3.1 Flash-Lite** | 0.287円 | **0.130円** | 55% |
| GLM-4.7 | 0.419円 | 0.195円 | 53% |
| **Grok 4.20** | 1.124円 | **0.391円** | 65% |
| Claude Haiku 4.5 | 1.085円 | 0.477円 | 56% |
| Claude Sonnet 5 | 2.170円 | 0.953円 | 56% |

### 事業インパクト（DAU 10,000 × 50ターン/日 = 月1,500万ターン）

| 構成 | 月間LLM原価 | ARPU換算 |
|---|---:|---:|
| Qwen3.7 Flash（0.015円） | **約23万円** | 23円/MAU |
| Gemini 2.5 Flash-Lite（0.040円） | 約60万円 | 60円/MAU |
| Gemini 3.1 Flash-Lite（0.130円） | 約195万円 | 195円/MAU |
| Grok 4.20（0.391円） | 約587万円 | 587円/MAU |
| Claude Sonnet 5（0.953円） | 約1,430万円 | 1,430円/MAU |

**結論:**
- **層1に 0.015〜0.040円/ターン を置けば「会話無制限無料+広告」（Zeta型）が構造的に成立する。** 動画広告eCPMを控えめに$3とすると、1日1本の広告視聴で約0.5円 ≒ **33ターン分の原価**を賄える
- **層2（0.10〜0.15円）をピース消費にすれば粗利率99%超。** FANZA Babechatの30pt/通に対して原価0.1円は**300倍のマージン**。**モデル階層課金は原価連動でなく体感価値の差別化装置**
- **キャッシュ実装は必須。** 未実装だと原価が2〜4倍。**最も費用対効果の高い1回きりのエンジニアリング投資**

---

## 9. 次にやるべきこと（優先度順）

1. **x.ai の Acceptable Use Policy 本文を自分の目で確認**（本調査ではWebFetch/curlともに403で一次取得不可）。R18戦略の最有力候補の根拠が二次情報のみという状態は看過できない
2. **社内日本語RP評価セットの構築**（30〜50シチュエーション×3ターン）。既存ベンチマークは敬語・省略・情緒の適切性を測れない。候補を `Gemini 2.5 Flash-Lite / Qwen3.7 Flash / GLM-4.7-Flash / MiniMax M2-her / DeepSeek V4 Flash` の5本に絞ってブラインド評価
3. **MiniMax M2-her の日本語RP性能の実測**。RP専用大規模モデルは他に存在せず、当たれば層2の決定版
4. **キャッシュ境界を設計に組み込む**（不変ブロック前置き / 要約更新頻度 / Lorebook挿入位置）
5. **DeepSeek V4 のライセンス確認**（オープンウェイトかどうか）。西側ホスト経由のR18経路の前提が変わる
6. **プロバイダ規約の週次diff監視**の仕組み化

## 10. 本調査の穴 [要追加調査]

- **英語のRP品質を評価していない。** グローバル展開（GTMは日本、プロダクトはグローバル）が前提になったため、層1・層2の候補について**英語ノベル品質の比較が別途必要**
- 韓国語・中国語・スペイン語など次の市場の言語も同様
- Fireworks / Groq の一次ポリシー未確認
- Infermatic / Arli AI の規約未確認

---

### 主要出典（一次）
[DeepSeek Pricing](https://api-docs.deepseek.com/quick_start/pricing) / [DeepSeek ToU](https://cdn.deepseek.com/policies/en-US/deepseek-terms-of-use.html) / [Gemini Pricing](https://ai.google.dev/gemini-api/docs/pricing) / [Gemini Safety](https://ai.google.dev/gemini-api/docs/safety-settings) / [Google GenAI Prohibited Use](https://policies.google.com/terms/generative-ai/use-policy) / [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) / [Mistral Usage Policy](https://legal.mistral.ai/terms/usage-policy) / [OpenRouter ToS](https://openrouter.ai/terms) / [OpenRouter Privacy](https://openrouter.ai/docs/features/privacy-and-logging) / [xAI Models](https://docs.x.ai/docs/models) / [Novita ToS](https://novita.ai/legal/terms-of-service) / [DeepInfra ToS](https://deepinfra.com/terms) / [Featherless ToS](https://featherless.ai/terms) / [SillyTavern World Info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/) / [GPT-OSS Swallow](https://swallow-llm.github.io/gptoss-swallow.ja.html) / [PLaMo API](https://plamo.preferredai.jp/api) / [Character.AI Engineering](https://blog.character.ai/optimizing-ai-inference-at-character-ai-part-deux-2/) / [FriendliAI × Scatter Lab](https://friendli.ai/customers/scatter-lab) / [Runpod × Scatter Lab](https://www.runpod.io/case-studies/how-scatterlab-powers-1-000-rps-with-runpod) / [Qualiteg 日本語LLMランキング2026](https://blog.qualiteg.com/llm-ranking-2026/) / [Legalscape トークナイザ効率](https://tech.legalscape.co.jp/entry/2025/10/28/150459)

**補足**: 日本語トークン効率のうち o200k_base / cl100k_base / DeepSeek-V3 / Mistral Nemo / GLM-4.5 / Qwen3 は、本調査で実トークナイザに女性向けノベル文体サンプルを通した**実測値**（tiktoken / transformers）。Gemini・Claude Opus 4.7以降は公開情報からの推定。
