import Link from "next/link";
import { GuideCta, GuideLayout } from "@/components/GuideLayout";
import { absoluteUrl, pageMetadata, serializeJsonLd } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Bukuchaとは｜恋愛シチュエーションを楽しむAIノベルチャット",
  description: "Bukuchaは、自分のセリフや行動で恋愛の物語に参加するAIノベルチャット。作品の楽しみ方、オリジナル作品の作成、AIによる生成の制限と投稿方針を紹介します。",
  path: "/about",
});

const QUESTIONS = [
  { question: "Bukuchaはどんなサービスですか？", answer: "恋愛シチュエーションを選び、主人公のセリフや行動を入力しながら物語を楽しむAIノベルチャットです。相手の返答や情景はAIが生成します。自分で世界観とキャラクターを設定する作品作成機能もあります。" },
  { question: "登録する前に試せますか？", answer: "ログイン前に利用できるゲスト体験があります。作品詳細から物語を始めると、体験を進めたところで登録案内が表示されます。物語の続きや本棚、作成機能などはログインして利用します。" },
  { question: "キャラクターの返事は誰かが書いていますか？", answer: "作品の作者が世界観やキャラクター、導入を設定し、会話の続きはAIが生成します。人間の相手とメッセージを交換するサービスではありません。" },
  { question: "どんな作品を公開できますか？", answer: "オリジナルのキャラクターと世界観による作品が対象です。既存作品のキャラクターや実在の人物を使うことは禁止されています。表現の範囲や禁止事項は、投稿・表現ガイドラインをご確認ください。" },
];

export default function AboutPage() {
  return (
    <GuideLayout breadcrumbs={[{ label: "Bukuchaについて" }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "ホーム", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Bukuchaについて", item: absoluteUrl("/about") },
        ],
      }) }} />
      <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--c-primary)" }}>ABOUT BUKUCHA</p>
      <h1 className="mt-3 text-[1.75rem] font-bold leading-snug">Bukuchaとは</h1>
      <p className="mt-5 text-lg font-semibold leading-8">読む恋から、<br />あなたの言葉でつづく物語へ。</p>
      <p className="mt-4 text-sm leading-8">
        Bukuchaは、恋愛シチュエーションを選び、主人公として物語に参加するAIノベルチャットです。セリフや動作を送ると、AIが相手の反応と情景を文章で生成します。読むことと、話すことが重なる創作体験です。
      </p>

      <section className="mt-9">
        <h2 className="text-xl font-bold">こんな楽しみ方ができます</h2>
        <div className="mt-5 space-y-5 text-sm leading-7">
          <div><h3 className="font-bold">好きなシチュエーションから入る</h3><p className="mt-2">作品の世界観、キャラクター、主人公との関係を読み、気になる場面から会話を始めます。恋愛小説の情景を読みながら、自分の言葉で相手に返したい方に向いています。</p></div>
          <div><h3 className="font-bold">言葉と仕草で物語に参加する</h3><p className="mt-2">短いセリフだけでも、動作を添えた文章でも返事ができます。ログイン後は返信候補、入力モード、記憶のユーザーノートなどを利用できます。</p></div>
          <div><h3 className="font-bold">オリジナルの作品をつくる</h3><p className="mt-2">作成画面では世界観、人物の性格や口調、イントロを設定します。テスト会話で雰囲気を確かめ、投稿方針に沿って作品を公開できます。</p></div>
        </div>
      </section>

      <section className="mt-9 rounded-2xl p-5" style={{ background: "var(--c-primarySoft)" }}>
        <h2 className="text-lg font-bold">AIの物語について</h2>
        <p className="mt-3 text-sm leading-7">返答はAIによるフィクションです。キャラクターの設定や会話の記憶が食い違うことがあり、特定の展開や結末、常に一貫した返答は保証されません。生成文を現実の事実や専門的な助言として扱わず、創作として楽しんでください。</p>
        <p className="mt-3 text-sm leading-7">ゲストとログイン後では使える機能が異なります。回数制限などが表示される場合は、利用画面の案内をご確認ください。</p>
      </section>

      <section className="mt-9">
        <h2 className="text-xl font-bold">オリジナル作品を大切に</h2>
        <p className="mt-4 text-sm leading-8">Bukuchaでは、既存作品のキャラクター名や作品名、実在の人物を使った作品の公開を禁止しています。表現の範囲は作品のコンテンツレベルごとに定められています。作成・公開の前に、<Link href="/legal/guideline" className="underline underline-offset-4" style={{ color: "var(--c-primary)" }}>投稿・表現ガイドライン</Link>をご確認ください。</p>
      </section>

      <section className="mt-9">
        <h2 className="text-xl font-bold">よくある質問</h2>
        <dl className="mt-5 space-y-6">
          {QUESTIONS.map((item) => <div key={item.question}><dt className="text-sm font-bold leading-7">{item.question}</dt><dd className="mt-2 text-sm leading-7">{item.answer}</dd></div>)}
        </dl>
      </section>

      <div className="mt-8 border-t pt-5 text-xs leading-6" style={{ borderColor: "var(--c-border)", color: "var(--c-textMuted)" }}>
        <p>内容更新：<time dateTime="2026-09-08">2026年9月8日</time></p>
        <p className="mt-2">具体的な操作や入力例は、<Link href="/guides" className="underline underline-offset-2">楽しみ方ガイド</Link>で紹介しています。</p>
      </div>
      <GuideCta href="/" label="物語を探す" description="あなたが返してみたい、一言のある物語へ。" />
    </GuideLayout>
  );
}
