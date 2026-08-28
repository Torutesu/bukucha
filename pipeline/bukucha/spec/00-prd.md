# PRD: HEADCANON

- version: 2
- source_teardown: ../teardown.md(OOC ベンチマーク / 北米限定)
- source_research: ../research/ooc.md, ../research/na-market.md
- supersedes: v1(Bukucha / 日本女性向け)。`../decisions.md` 2026-08-28 の方針転換を参照

## target_users

北米(US + CA)の 16〜34歳、アニメ / マンガ / JRPG / インタラクティブフィクション層。
とくに **AO3・Wattpad・SillyTavern・r/CharacterAI に既にいる、「書く側」にもなり得る読者**。
性別で棚を分けない(北米にその市場慣行がない)。

彼らの現在地:
- Character.AI のフィルタに疲れている(「character ai alternative」だけで月12,000+検索)
- Janitor AI の摩擦に疲れている(Limitless Mode は ID 認証必須)
- そして **OOC の課金メーターに疲れている**(否定レビューの約69%)

## mvp_scope

[SCR-001, SCR-002, SCR-003, SCR-005, SCR-006, SCR-007, SCR-009, SCR-010, SCR-011,
 SCR-012, SCR-014, SCR-015, SCR-017, SCR-018, SCR-020, SCR-021, SCR-022, SCR-024,
 SCR-025, SCR-026]

**20画面。**うち SCR-021 / 022 / 024 / 025 は v1 に存在しなかった、この方針転換の中核。
SCR-026(供給レーン)は 2026-08-28 の供給側の決定で追加。

## out_of_scope

- SCR-004 ランキング(ホームの「Being played right now」で代替)
- SCR-008 Route Map(スキーマ `forkedFromRouteId` と `copyForkState()` は実装済み、UIのみP1)
- SCR-013 作者公開ページ / SCR-016 Rewards / SCR-019 通知 / SCR-023 スラッシュコマンド
- **決済の実装**(プラン表示と上限管理まで。Stripe 接続はP1)
- クリエイター送金の実装(`CreatorEarning` の集計まで)
- シーン画像(`{{img:}}` トリガー)、音声、ネイティブアプリ申請
- **成人向け(MATURE)層**(`ContentLevel` は3値で持つが MVP では使わない — `../decisions.md` 判断B)
- AIF-011〜014(投機的先読み / 分岐提案 / 公開前AI試遊 / タグ自動付与)

## success_criteria

| # | 条件 | 状態 |
|---|---|---|
| 1 | **E2E P0 26件を含む32件が全通過** | ✅ 達成(連続2回グリーン) |
| 2 | **記憶精度**: 10ターン以上前に確定した事実が、現在のプロンプトに残っている | ✅ E2E-024 で自動検証 |
| 3 | **Canon の編集が課金・計量を一切通らない** | ✅ コードで保証(02-schema #4) |
| 4 | `npm run build` / `tsc --noEmit` / `eslint` がクリーン | ✅ |
| 5 | 作品ページが未ログイン・JS無効で読め、OGP と JSON-LD を持つ | ✅ E2E-023 |
| 6 | 一文入力から公開まで15分以内で完遂できる | ✅ E2E-013 |
| 7 | AI下書きが stats / endings(SSRにルール付き)/ keywords まで出す | ✅ E2E-027 |
| 7b | **既存の散文からも同じ構造水準の作品が出る** | ✅ E2E-033 |
| 7c | **取り込んだカードは公開できない**(サーバー側で強制) | ✅ E2E-031 |
| 8 | 1440px でリーダーが2ペインになり、390px で崩れない | ✅ E2E-022 |
| 9 | **1ターンあたり LLM 原価の実測** | ❌ 未実施。**Free 無制限を確約する前の必須ゲート** |
| 10 | 平均セッション30分以上 / D1リテンション | ❌ 実ユーザー待ち |

## プロダクト原則(実装で迷ったらここに戻る)

1. **記憶は読者のもの**。物語が忘れたことを、読者が無料で・即座に・謝罪なしに直せる。
   これを課金対象にした瞬間、この製品の存在理由が消える
2. **核となる読書体験にメーターを付けない**。Standard は全プランで無制限。
   上位モデルが尽きたら**止めるのではなく落とす**
3. **構造がある物語**。stat / ending / keyword book を持つ「遊べる物語」であり、無限チャットではない
4. **作らせる、そして報いる**。門を置かず、1ターン目から収益が積まれ、**著作権は作者に残る**。
   翻案でも同じ — **独占は取らない**(`StoryLicense.exclusive` を false 既定でデータに残す)。
   ただし作り手向けの武器は**読者が居てから効く**ので、ローンチ在庫は自前+翻案で積む
   (`../research/na-supply.md`)
5. **発見はアプリの外にある**。作品ページは SSR + OGP + JSON-LD。人はアプリではなく相手を検索する
6. **安全は機能である**。開示・休憩・危機介入は義務であると同時に、
   「ストアから消えない場所」という競争優位でもある
7. **判定はすべてサーバー側**。クライアントは表示のみ

## MVP 検証仮説

> **記憶が壊れず、メーターを気にせず遊べる playable anime は、
> Character.AI 離脱層と OOC 課金疲れ層を引き寄せられるか。**

この市場では**どのプラットフォームも約18ヶ月を超えて首位を維持できていない**
(`../research/na-market.md` §2)。乗り換えコストが極端に低いからだ。
裏を返せば、**「乗り換えても自分の物語が失われない」ことを設計すれば、それが唯一のロックインになる。**
Canon はリテンション機能であると同時に、この市場で唯一成立するロックインでもある。

## スコープ規模

- 画面: **20**
- E2E: **32**(P0 26 / P1 6)— 全通過
- AIF: **11**(すべて fallback 定義済み)
- スキーマ: **25モデル + 14 enum**

## シードコンテンツ

- 運営制作の英語作品 **22本**。トロープは AO3 型(slow burn / enemies to lovers / found family /
  isekai / court intrigue / cyberpunk ほか)
- 旗艦作品 `story_e2e_main` は **stats 2種(レベル帯付き)+ endings 4種(N/R/SR/SSR)+ keyword book 3件**を
  完全に作り込んである。E2E とドッグフーディングの土台
- タグマスタ: trope 12 / relationship 12 / genre 12 / warning 4 = **40**

## 技術方針

- Next.js (App Router) + PostgreSQL + Prisma + 署名Cookieセッション
- LLM は `app/src/lib/llm` の抽象化レイヤ越し。**STANDARD / CINEMATIC の2階層**、env でモデルID差し替え
- SSE ストリーミング。イベント契約は 03-api.md
- ブランドは `app/brand.config.ts` の1ファイル。**差し替えで別ブランド(や日本版)を吐き出せる構造を維持**
- iOS/Android は P1 で Capacitor ラップ。ストアビルドは `ContentLevel.ALL_AGES/TEEN` のみ

## Phase 2 以降(設計上は考慮済み)

Route Map の UI / 決済(Stripe 主・ストア従)/ 通知 / クリエイター送金 / 作者ページ / ランキング /
スラッシュコマンド共有ハブ / シーン画像 / 成人層(Web + 第三者年齢認証)。
スキーマ・LLMレイヤ・安全レイヤはいずれも上記を前提に設計してある。
