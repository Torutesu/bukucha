# SCR-010: Character editor
- route: /create/[sid]/characters/[cid]
- auth: authenticated (owner)
- purpose: 声を決める。ここが決まらないと物語は他人事になる。

## Layout
```
 ← Back to the builder
 Character
 Name        [ Aldric Vaun ]
 ( ) Lead  ( ) Supporting
 Personality [ ......... ]
 Voice       [ Rhythm, register, what they call you… ]
 Relationship to you [ ......... ]
 Sample exchanges (up to 5)
   [you]  [them]           + Add
   [ Write samples for me ]
 [ Save and go back ]      Delete this character
```

## Components
| Component | Behavior | Data |
|---|---|---|
| lead / supporting | `sortOrder` 0 が主演 | PATCH .../characters/{cid} |
| sample exchanges | 最大5組。few-shot としてプロンプトに入る | — |
| AI samples | 性格と口調から3組生成 | POST .../sample-dialogs |
| delete | **最後の1人は削除できない** | DELETE |

## States
- loading / error(「We could not load that.」)/ saved(ビルダーに戻る)

## Interactions
- Save and go back → SCR-009 Step2

## AI Behaviors
- AIF-008 会話例生成。fallback は中立テンプレ3組。**欄を空のままにしない**
