# SCR-020: 規約・法令ページ
- route: /legal/terms, /legal/privacy, /legal/tokushoho, /legal/guideline
- auth: public
- purpose: 法令対応と表現ガイドラインの明示(pixiv型の後出し規制を避けるため、ガイドラインは初日から公開 [USER-REQ由来])

## Layout
静的文書ページ(共通レイアウト: 中央480px、目次付き)。

- /legal/terms: 利用規約
- /legal/privacy: プライバシーポリシー
- /legal/tokushoho: 特定商取引法に基づく表記(課金導入時に必須。MVP時点でも事業者情報を掲載)
- /legal/guideline: **投稿・表現ガイドライン**
  - オリジナル作品のみ(二次創作・既存IP・実在人物の禁止) [USER-REQ]
  - コンテンツレベルの定義(全年齢/R15の線引き。R15=比喩・状況描写まで、直接的な性行為描写・露骨な語は不可 — Zeta同等ライン)
  - R15でも不可: 未成年を性的に扱う表現、非同意の性表現、その他法令違反(将来のR18解放時のカードブランド制約を先回りして最初から明記 — variants/web-r18-variant.md §3.4)
  - 違反時の措置(非公開化・アカウント停止)と異議申し立て窓口

## Components
| Component | Behavior | Data |
|---|---|---|
| StaticDoc | Markdownレンダリング+目次 | リポジトリ内md管理(CMS不要) |

## States
- success のみ(静的)

## Interactions
- フッター(全画面共通)と SCR-014/017 からリンク

## AI Behaviors
- none

## 備考(build時のコンテンツ)
- 規約文面はテンプレートを置き、`[要確認]` マーカー付きで事業者情報(社名・住所・連絡先)をプレースホルダにする。**公開前に法務レビュー必須である旨をREADMEに明記**
