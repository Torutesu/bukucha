# SCR-010: キャラ編集(作成ウィザード内サブ画面)
- route: /create/[situationId]/characters/[characterId] (新規は /create/[situationId]/characters/new)
- auth: authenticated (作者本人のみ)
- purpose: シチュエーションに従属するキャラの人格・口調を定義する(キャラ単体は存在しない [USER-REQ])

## Layout
```
┌──────────────────────┐
│ [← 作成にもどる]  キャラ編集  │
│ [画像○] 名前 [________]    │ ← 画像=プリセットアバター24種 or アップロード
│ 主演/脇役 (●主演 ○脇役)     │ ← sortOrder 0 or 1+
│ ── 性格 ──              │
│ [textarea 1000字]        │
│ ── 口調・話し方 ──         │
│ [textarea 600字]         │ ← プレースホルダ: 一人称、語尾、敬語/タメ口、呼び方
│ ── 主人公との関係 ──       │
│ [textarea 600字]         │
│ ── 会話例(最大5組) ──      │
│ あなた:[____] キャラ:[____] │ ← few-shotペア。[＋追加]
│ [✦ 口調サンプルをAIに作らせる] │
│ [保存して戻る]             │
└──────────────────────┘
```

## Components
| Component | Behavior | Data |
|---|---|---|
| AvatarPicker | プリセット24種+アップロード | POST /api/uploads |
| RoleToggle | 主演は常に1人(既存主演がいる状態で主演にすると入替確認) | Character.sortOrder |
| PersonaForm | personality/speechStyle/relationship | PATCH /api/situations/:sid/characters/:cid |
| ExampleDialogEditor | user/charのペア入力。ドラッグ並び替え不要(追加順) | exampleDialogs Json |
| AiSampleButton | 性格・口調から会話例3組を自動生成し、空欄に補充(既入力は上書きしない) | POST /api/situations/:sid/characters/:cid/sample-dialogs |
| DeleteButton | キャラ削除(最後の1人は削除不可) | DELETE 同上 |

## States
- loading / error(保存失敗はトースト+ローカル保持) / success
- validation: 名前必須(30字)、性格必須。会話例は任意

## Interactions
- 保存して戻る → SCR-009 Step2へ(リストに反映)
- AIサンプル生成 → 会話例欄に3組補充(編集可能)

## AI Behaviors
- AIF-002c: 会話例サンプル生成(fallback: 失敗時はテンプレ例文を提示)
