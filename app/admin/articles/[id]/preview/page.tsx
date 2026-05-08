import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getArticleDetail } from "@/lib/admin/articles/get-articles";
import { ArticleFooter } from "@/components/articles/ArticleFooter";
import { ArticleBodyStyles } from "@/components/articles/ArticleBodyStyles";
import { PreviewMemberStateSwitcher } from "@/components/articles/PreviewMemberStateSwitcher";
import { TableScrollHint } from "@/components/articles/TableScrollHint";

export const metadata = { title: "記事プレビュー" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  published: "公開中",
  archived: "アーカイブ",
};

export default async function ArticlePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getArticleDetail(id);
  if (!article) notFound();

  return (
    <div>
      {/* 上部バー：プレビューモードである旨と、編集に戻るリンク */}
      <div className="sticky top-16 z-20 -mx-6 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50/70 px-6 py-3 text-sm backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        <div className="flex items-center gap-2 text-amber-900">
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold">
            プレビュー
          </span>
          <span className="text-xs">
            {STATUS_LABEL[article.status] ?? article.status} の状態を読者目線でプレビュー中
          </span>
        </div>
        <Link
          href={`/admin/articles/${article.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-muted"
        >
          <Pencil className="h-3.5 w-3.5" />
          編集に戻る
        </Link>
      </div>

      <article className="article-preview mx-auto max-w-3xl">
        {/* 関連企業（チップ） */}
        {article.companies.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {article.companies.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full border border-surface-border bg-white px-2 py-0.5 text-xs text-ink-muted"
              >
                {c.name}
                {c.industry_name && (
                  <span className="text-ink-subtle">/ {c.industry_name}</span>
                )}
              </span>
            ))}
          </div>
        )}

        {/* タイトル */}
        <h1 className="mb-8 text-4xl font-bold leading-[1.35] tracking-[0.01em] text-ink sm:text-5xl">
          {article.title || "（無題）"}
        </h1>

        {/* メンバー限定セクションの「見え方」をテスト切替できるスイッチャー */}
        <PreviewMemberStateSwitcher
          returnTo={`/admin/articles/${article.id}/preview`}
        />

        {/* 本文（TipTap が出力した HTML をそのまま流し込み） */}
        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: article.body_html || "" }}
        />

        {/* 出典 / 編集方針 / 著者カードを自動挿入（テンプレ §4.13/§4.14 の後継） */}
        <ArticleFooter articleId={article.id} />

        {/* スクロール可能な表に「→」ヒントを付与 */}
        <TableScrollHint selector=".article-body" />

        <div className="mt-12 border-t border-surface-border pt-6 text-xs text-ink-subtle">
          <Link
            href={`/admin/articles/${article.id}`}
            className="inline-flex items-center gap-1 hover:text-brand-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            編集画面へ戻る
          </Link>
        </div>
      </article>

      {/* 共通記事スタイル：エディタ・公開ページと同一の見た目を保証 */}
      <ArticleBodyStyles />
    </div>
  );
}
