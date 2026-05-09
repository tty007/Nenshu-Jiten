import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { ArticleBodyStyles } from "@/components/articles/ArticleBodyStyles";
import { ArticleFooter } from "@/components/articles/ArticleFooter";
import { ArticleToc } from "@/components/articles/ArticleToc";
import { MemberOnlyController } from "@/components/articles/MemberOnlyController";
import { TableScrollHint } from "@/components/articles/TableScrollHint";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  jsonLdToScript,
} from "@/lib/article-jsonld";
import { extractTocAndAddIds } from "@/lib/article-toc";
import { getPublishedArticle } from "@/lib/data/published-article";
import { trackArticleView } from "@/lib/data/track-entity-view";

// 動的ルート：UserMenu 内で cookies() を読むため SSG ではなく動的レンダリング
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const idOrSlug = (slug ?? []).join("/");
  const article = await getPublishedArticle(idOrSlug);
  if (!article) return { title: "記事が見つかりません" };
  // 本文先頭から description を抽出（HTML タグ除去 → 100 字）
  const txt = (article.body_html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const description = txt.slice(0, 120);
  return {
    title: article.title || "（無題）",
    description,
    openGraph: {
      title: article.title || "（無題）",
      description,
      type: "article",
      modifiedTime: article.updated_at,
    },
  };
}

export default async function PublicArticlePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const idOrSlug = (slug ?? []).join("/");
  const article = await getPublishedArticle(idOrSlug);
  if (!article) notFound();

  // PV を fire-and-forget で記録。集計は article_page_views(date, article_id, count)。
  void trackArticleView(article.id);

  // 目次（メンバー限定セクションも見出しは表示するので含める）
  const { toc, htmlWithIds } = extractTocAndAddIds(article.body_html ?? "");

  // 構造化データ（ユーザ UI への影響なし。クロール時のみ参照される）
  const articleJsonLd = buildArticleJsonLd(article);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(article);

  return (
    <>
      {/* Schema.org JSON-LD（Article + ペイウォール宣言 + パンくず） */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdToScript(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdToScript(breadcrumbJsonLd) }}
      />
      <Header />
      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
        {/* 関連企業（チップ） */}
        {article.companies.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {article.companies.map((c) => (
              <Link
                key={c.id}
                href={`/companies/${encodeURIComponent(c.edinet_code)}`}
                className="inline-flex items-center gap-1 rounded-full border border-surface-border bg-white px-2.5 py-0.5 text-xs text-ink-muted transition hover:border-ink/30 hover:text-ink"
              >
                {c.name}
                {c.industry_name && (
                  <span className="text-ink-subtle">/ {c.industry_name}</span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* タイトル */}
        <h1 className="mb-6 text-3xl font-bold leading-[1.55] tracking-[0.01em] text-ink sm:text-4xl">
          {article.title || "（無題）"}
        </h1>

        {/* 目次（タイトルの真下） */}
        <ArticleToc items={toc} />

        {/* 本文（公開部分） */}
        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: htmlWithIds }}
        />

        {/* メンバー限定マーカーの解除コントローラ（auth + profile チェック） */}
        <MemberOnlyController
          returnTo={`/articles/${article.slug ?? article.id}`}
        />

        {/* 著者カード（自動挿入） */}
        <ArticleFooter articleId={article.id} />

        {/* 共通スタイル + スクロールヒント */}
        <ArticleBodyStyles />
        <TableScrollHint selector=".article-body" />
      </main>
      <Footer />
    </>
  );
}
