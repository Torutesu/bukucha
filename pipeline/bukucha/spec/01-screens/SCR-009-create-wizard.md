# SCR-009: シチュエーション作成ウィザード ★UGCの核
- route: /create (新規) / /create/[situationId] (編集再開)
- auth: authenticated
- purpose: 「妄想の一文」から公開まで。AIが下書きし、人が仕上げる [USER-REQ: 妄想の具現化]

## Layout
```
Step0 妄想入力 ──────────────
│ あなたの妄想を、一文で。        │
│ ┌──────────────────┐  │
│ │例: 没落令嬢の私を買ったのは、 │  │ ← textarea(20〜200字)。SCR-003から検索語引き継ぎ可
│ │冷酷と噂の若き公爵だった     │  │
│ └──────────────────┘  │
│ [ AIに下書きしてもらう ✦ ]     │
│ (または [白紙から作る])        │
─ 生成中: "世界を組み立てています…" プログレス演出(3段階表示: 世界観→人物→冒頭) ─

Step1 世界観 ── [タイトル][一言][世界観長文][表紙(プリセット12種 or アップロード)]
Step2 人物   ── キャラリスト(1..3)。各行タップで SCR-010 へ。[＋人物を追加]
Step3 はじまり ── IntroVariantリスト(1..3)。各: [ラベル][導入の地の文][最初の返答]
Step4 テスト  ── その場で3往復まで試し読み(本番と同じAIF-001、保存されない)
Step5 公開   ── [タグ選択(最大6)][コンテンツレベル: 全年齢/R15][公開/非公開]
              [公開する] → AIF-006チェック → 結果表示

共通: 上部にステップインジケータ(0〜5)。各Stepの[次へ]で自動保存(DRAFT)。
      離脱→再開可能(SCR-012の下書きから)
```

## Components
| Component | Behavior | Data |
|---|---|---|
| FantasyInput | 一文入力→「AIに下書き」でAIF-002呼び出し。結果でStep1〜3のフォームを埋めStep1へ | POST /api/situations/draft |
| WorldForm | title(60字)/catchphrase(60字)/worldSetting(4000字)。各項目に「✦AIに書き直してもらう」ミニボタン(その項目のみ再生成) | PATCH /api/situations/:id |
| CoverPicker | 運営プリセット12種+アップロード(5MB, jpg/png/webp)。[ASSUMED: MVPはAI画像生成なし(decisions.md #4由来のコスト方針)] | POST /api/uploads |
| CharacterList | 並び順=sortOrder(先頭が主演)。タップ→SCR-010 | Character |
| IntroList | 1..3件。各フォーム: label(30字)/introText(2000字)/firstMessage(1000字) | IntroVariant |
| TestChat | SCR-006の簡易版(3往復、リロールのみ可)。「この口調でOK?」の確認が目的 | POST /api/situations/:id/test-turn |
| PublishForm | タグ選択(検索付きモーダル)、contentLevelラジオ(R15選択時は注意文言表示)、公開/非公開 | POST /api/situations/:id/publish |
| ModerationResult | AIF-006結果。pass→公開完了画面(「作品ページを見る」→SCR-005/「Xでシェア」)。fail→理由表示(該当箇所引用)+修正導線 | ModerationFlag |

## States
- loading(AI下書き生成中): 3段階プログレス演出。**30秒でタイムアウト→「白紙から作る」へ誘導+再試行**(AIF-002 fallback)
- error(保存失敗): トースト+リトライ。入力内容はローカルに保持し消さない
- blocked(公開チェックNG): IP_DETECTED=「既存作品のキャラクター・作品名が含まれています(検出: ○○)。Bukuchaはオリジナル作品のみ公開できます」/ CONTENT_OVER_LINE=「表現ガイドラインの範囲を超えています(該当箇所)」
- success(公開完了): 祝祭演出(コンフェッティ)+作品ページへ

## Interactions
- Step0でAI下書き → フォーム全埋め(ユーザーは編集するだけ)
- 各Step[次へ] → バリデーション→自動保存→次Step
- Step5[公開する] → AIF-006 → pass: PUBLISHED / fail: 理由表示(DRAFTのまま)
- 非公開で保存 → PRIVATE(自分だけがSCR-005/006でプレイ可)

## AI Behaviors
- AIF-002: 妄想→下書き一括生成(Step0)
- AIF-002b: 項目単位の書き直し(各フォームの✦ボタン)
- AIF-001/005/007: Step4テスト会話(本番同等)
- AIF-006: 公開前チェック(二次創作IP検出+コンテンツレベル判定+禁止表現)
