# SCR-020: Policy pages
- route: /legal/[doc] — terms | privacy | content | safety | dmca
- auth: public(静的生成)
- purpose: 米国・カナダで営業するための最低限を、読める英語で置く。

## Documents
| slug | title | 中身 |
|---|---|---|
| `terms` | Terms of Service | フィクションであること / 13歳以上 / **著作権は作者に残る非独占ライセンス** / Standard 無制限 / **クレジットは失効しない** |
| `privacy` | Privacy Policy | 取得項目 / 用途 / **CCPA-CPRA の「販売・共有しない」明示** / PIPEDA / 13歳未満に向けない |
| `content` | Content Policy | **オリジナルのみ** / All ages と 18+ の線 / どのレーティングでも不可の項目 / 執行と異議申立 |
| `safety` | AI Safeguards | **AIであることの開示と3時間ごとの再掲** / 未成年は1時間 / 危機時は生成を止めて 988 / 証跡を残すこと |
| `dmca` | Copyright and DMCA | 通知 / 反対通知 / 反復侵害者の停止 |

## Layout
本文 + 末尾に5文書間のナビゲーション。

## States
存在しない slug → `notFound()`

## Interactions
SCR-014 / SCR-017 からのリンク。

## AI Behaviors
none

## 未確定 [要確認]
本文中に `[TO CONFIRM]` として明示してある: 準拠法・事業者情報・仲裁条項 / 保存期間・再委託先・越境移転の根拠 /
ケベック州 Law 25 のフランス語表示 / DMCA 指定代理人の登録。**すべて公開前に法務レビューが必要。**

## 日本版から消えたもの
特定商取引法・資金決済法の表記は北米では不要。代わりに DMCA と AI Safeguards が入る。
