import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brand } from "@/lib/theme";
import { pageMetadata } from "@/lib/seo";

// SCR-020: 規約・法令ページ
const DOCS: Record<string, { title: string; body: string }> = {
  terms: {
    title: "利用規約",
    body: `本規約は、${brand.name}(以下「本サービス」)の利用条件を定めるものです。

1. 本サービスはフィクションの創作・閲覧を目的としたAIチャットサービスです。
2. ユーザーは自己の責任において本サービスを利用するものとします。
3. [要確認] 事業者情報・準拠法等は公開前に法務レビューのうえ確定してください。`,
  },
  privacy: {
    title: "プライバシーポリシー",
    body: `本サービスは、ユーザーの個人情報を適切に取り扱います。

- 会話ログは体験向上のために保存されますが、外部への販売は行いません。
- [要確認] 取得情報の範囲・第三者提供・保存期間は公開前に確定してください。`,
  },
  tokushoho: {
    title: "特定商取引法に基づく表記",
    body: `[要確認] 課金導入前に以下を確定してください。

- 販売事業者: (要記載)
- 所在地・連絡先: (要記載)
- 販売価格・支払方法・提供時期・返品条件: (要記載)`,
  },
  guideline: {
    title: "投稿・表現ガイドライン",
    body: `${brand.name}に作品を公開するすべての方に、以下を守っていただきます。

【オリジナル作品のみ】
既存のアニメ・漫画・ゲーム・小説等のキャラクター名・作品名・実在の人物を使用することはできません(二次創作の禁止)。検出された場合は公開できません。

【コンテンツレベル】
- 全年齢: 恋愛感情・ときめきの描写。性的描写は含みません。
- R15(センシティブ): 官能的な緊張感・比喩・状況描写まで。直接的な性行為の描写や露骨な語は含みません。年齢確認済みの読者にのみ表示されます。

【R15でも禁止される表現】
- 未成年を性的に扱う表現
- 非同意(強制)の性的表現
- その他、法令に違反する内容

【違反時の措置】
ガイドライン違反の作品は非公開化され、繰り返す場合はアカウントを停止することがあります。異議がある場合はお問い合わせください。`,
  },
};

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const content = DOCS[doc];
  if (!content) notFound();
  return pageMetadata({
    title: content.title,
    description: `${brand.name}の${content.title}。オリジナル作品の創作・閲覧に関する方針をご案内します。`,
    path: `/legal/${doc}`,
    // Other documents contain unresolved operator/privacy placeholders.
    index: doc === "guideline",
  });
}

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const content = DOCS[doc];
  if (!content) notFound();
  return (
    <main className="px-5 py-8">
      <Link href="/" className="text-sm" style={{ color: "var(--c-textMuted)" }}>
        <ArrowLeft size={15} className="mr-1 inline align-[-2px]" /> もどる
      </Link>
      <h1 className="mt-4 text-xl font-bold">{content.title}</h1>
      <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{content.body}</div>
      <nav className="mt-8 flex flex-wrap gap-3 text-xs" style={{ color: "var(--c-accent)" }}>
        <Link href="/legal/terms">利用規約</Link>
        <Link href="/legal/privacy">プライバシー</Link>
        <Link href="/legal/guideline">ガイドライン</Link>
        <Link href="/legal/tokushoho">特商法</Link>
      </nav>
    </main>
  );
}
