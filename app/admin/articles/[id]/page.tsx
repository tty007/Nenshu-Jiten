import { notFound } from "next/navigation";
import { ArticleEditor } from "@/components/admin/articles/ArticleEditor";
import { getArticleDetail } from "@/lib/admin/articles/get-articles";
import { getAuthorById } from "@/lib/admin/articles/get-authors";
import { getCategoryById } from "@/lib/admin/articles/get-categories";

export const metadata = { title: "記事編集" };
export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getArticleDetail(id);
  if (!article) notFound();

  const author = article.author_id
    ? await getAuthorById(article.author_id)
    : null;
  const category = article.category_id
    ? await getCategoryById(article.category_id)
    : null;

  return (
    <ArticleEditor
      articleId={article.id}
      initialTitle={article.title}
      initialBodyHtml={article.body_html}
      initialBodyJson={article.body_json}
      initialStatus={article.status}
      initialCompanies={article.companies.map((c) => ({
        id: c.id,
        edinet_code: c.edinet_code,
        name: c.name,
        industry_name: c.industry_name,
      }))}
      initialAuthor={
        author
          ? {
              id: author.id,
              name: author.name,
              title: author.title,
              avatar_url: author.avatar_url,
            }
          : null
      }
      initialCategory={
        category
          ? {
              id: category.id,
              slug_path: category.slug_path,
              name_path: category.name_path,
            }
          : null
      }
      initialSlug={article.slug}
      updatedAt={article.updated_at}
    />
  );
}
