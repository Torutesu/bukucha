# SEO実装・検証・公開手順

実装日: 2026-09-08。戦略は [seo-geo-llmo-strategy.md](./seo-geo-llmo-strategy.md)。この変更はソースとローカル検証であり、本番反映や検索順位・AI引用の実績とは区別する。

## 実装したこと

- ホーム: 匿名向けの公開作品と説明をSSR。初回の強制転送を廃止し、好みの選択は通常リンクから利用。ログイン中の好みはブラウザで適用する。
- 作品紹介: 既存の認可をサーバーで確認し、紹介本文をSSR。公開かつ全年齢の作品だけに作品固有metadataとCreativeWorkを出す。本人向けプレビューと許可済みR15は一般的なタイトルとnoindexを返す。
- 新規ページ: `/about`、`/guides`、実用ガイド3本。本文、入力例、FAQ、関連記事、読書・作成への導線を追加。
- canonical、description、OG/Twitter、WebSite/Article/BreadcrumbList、SNS共有用PNGを整備。架空の運営者・評価・価格は追加しない。
- `robots.txt`: 公開ページの検索botアクセスを許可し、APIを除外。個人画面にはnoindexを読めるようクロールを許可。APIには `X-Robots-Tag: noindex, nofollow` も付ける。
- `sitemap.xml`: 全年齢設定の公開作品と実在する公開案内だけを掲載。リクエストごとに現在の公開状態を参照する。DB障害を空の成功レスポンスに変換しない。
- 個人画面、検索結果、将来追加される画面はルートの既定値でnoindex。公開ページだけ明示的にindexを有効化。
- Vercel previewは全体noindex、robots拒否、空のsitemap。独自ドメインに移転する場合もプレビューのホストをcanonicalに採用しない。
- ホームのローカル表紙はNext Imageで配信サイズを最適化。先頭表紙は優先取得、後続は遅延読み込み。

作品の `updatedAt` はいいね数等でも変わるため、コンテンツ更新日時としてsitemapに出していない。ガイドは実際の編集日 `updatedAt` から可視日付・構造化データ・sitemapを生成する。

## 環境変数

| 変数 | 用途・既定 |
|---|---|
| `SITE_URL` | 正規origin。既定 `https://bukucha.vercel.app`。パス・query・fragment・認証情報は禁止。独自ドメインに変えるときは確定したoriginを指定 |
| `SEO_INDEXABLE` | `false`で全体を索引対象外にする。デモ/検証用途。変更後は再ビルドが必要 |
| `VERCEL_ENV` | Vercelの自動値。`preview`なら他の設定によらず索引対象外 |
| `GOOGLE_SITE_VERIFICATION` | Search Consoleから発行された実際のHTMLタグのcontent値。未設定時はタグを出さない |
| `BING_SITE_VERIFICATION` | Bing Webmaster Toolsから発行された実際のcontent値。未設定時はタグを出さない |

metadata/robots/ガイドはビルド時生成を含むので、設定変更後は再ビルド・再デプロイし、公開HTMLで確認する。検索botの許可とモデル学習への許可は別の方針で、今回学習bot専用の許可・拒否設定は追加していない。

## ローカル再検証

`app`で実行する。専用の **ローカル** PostgreSQLデータベース `bukucha_seo` を用意する。通常E2Eのglobal-setupは使用しない。以下の変数はローカルテスト限定で、本番にコピーしない。

```sh
export DATABASE_URL=postgresql://bukucha@127.0.0.1:55438/bukucha_seo
export DIRECT_URL="$DATABASE_URL"
export SEO_DATABASE_URL="$DATABASE_URL"
export AUTH_SECRET=seo-local-test-only
export SEO_AUTH_SECRET=seo-local-test-only
export AUTH_DEV_MODE=true
export LLM_PROVIDER=mock
npm ci
npx prisma migrate deploy
npm run db:seed
npm run lint
npm run build
npm run start -- -p 3129
```

別のターミナルで同じローカルDB変数を設定して実行する。

```sh
SEO_BASE_URL=http://localhost:3129 npm run test:seo
```

Playwright Chromiumが未導入なら `npx playwright install chromium`。既存Chromiumを使う場合は `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` を指定できる。

テストは、JavaScriptなしの本文、canonical・JSON-LD、初回導線、タグの応答競合、各画面のnoindex、サイトマップ、実HTTP404、認証されたプレビュー、個人設定の非露出、いいねとゲスト開始、PNGの寸法を確認する。作品テストは専用fixtureのみを作成・削除し、接続先がloopbackかつ `bukucha_seo` でなければ拒否する。

今回のローカルNext 16.3/Turbopack開発サーバーでは、OG画像の取得時にsharpの `Input buffer contains unsupported image format` が発生した。本番ビルドの同じ画像は200・1200×630のPNGで取得できた。依存ライブラリをパッチせず、本番ビルドでの検証を採用している。

## 本番へ反映するとき

1. 対象Vercel project、production branch、実際に公開するcommit、正規originを照合する。GitHubの既定ブランチとmainが異なるため、既定値を推測しない。
2. 現行 `vercel-build` はDBマイグレーション・seed・コンテンツ同期を含む。環境ごとのDBを確認する。プレビューが本番DBを更新しないよう設定する。
3. デモの認証設定、運営・プライバシー説明、投稿公開条件を確認したうえで、本番の索引方針を決める。詳細は戦略書の公開依存を参照。
4. この変更を含むsource commitのReadyを確認し、本番 `/`、`/about`、ガイド、公開作品、`/robots.txt`、`/sitemap.xml`、`/opengraph-image` を再取得する。
5. 公開HTMLのcanonical、robots、本文、構造化データを確認。非公開・年齢制限作品を匿名に出していないことを確認する。テストfixtureを本番に作らない。
6. Search Console/Bingの所有確認・sitemap送信・代表URL検査・利用できるAI参加設定とレポート確認を行う。

GSC/Bingの接続、外部analyticsへの送信、検索エンジンへのURL送信はこのソース変更では実行していない。CV計測は戦略書の仕様案までで、運用基盤を接続してから実測する。

## 継続時の注意

- 新しい公開ページは共通の `pageMetadata` で明示的にindexを許可し、実在するURLのみsitemap・内部リンクへ追加する。
- 作品数がsitemap上限の50,000 URLに近づいたら分割する。現在の実装は単一sitemapで、件数を黙って切り捨てない。
- メタデータ待機を全UAに適用し、非公開作品の404がHTML送信後の200にならないようにしている。共有キャッシュで認証結果を再利用せず、TTFBは公開後に実測する。
- 公開APIの既存レスポンスに含まれる作者向け設定や、公開作品編集時の再審査は別途改善が必要。今回のSSR propsからは私的な設定を除いている。


## 今回の検証結果

- 最終本番ビルド、TypeScript、ESLint、git diff --check: 通過。
- SEO/作品操作の統合テスト: 12件通過、4.7秒。LLMはモック、今回専用のローカルDBのみ使用。
- Previewビルド: ホーム・ガイド・作品がnoindex、robots全拒否、sitemap空を実HTTPで確認。
- モバイル390pxでホーム・ガイドを目視確認。デスクトップ1440pxでshell幅480px、横はみ出しなし。
- 本番モードの作品画面で冒頭選択・再読み込み・いいね等が動作し、console errorなし。
- GSC: 現在の接続アカウントに該当プロパティなし。Bing: 未ログインのためプロパティ不明。送信・設定変更なし。
- 既存本番はVercel project `bukucha` / deployment `dpl_688hb6rHrC8qRsRNx8vCkGaWxfcq` READY。プロジェクトにGit連携がなく、deploymentのgitSourceもない。新変更の本番反映・source SHAの照合・検索登録は未実施。

旧P0 E2E全体、実LLM、本番アカウントの登録・外部通知、Google/Bing実クローラーからの取得、検索順位・AI引用率・CV改善は今回のpassに含めない。DB障害時に404へ変換しないことはコードを確認したが、障害注入テストは実施していない。
