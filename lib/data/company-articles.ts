import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type CompanyArticle = {
  id: string;
  slug: string | null;
  title: string;
  /** 本文先頭のテキスト抜粋（120 字程度） */
  excerpt: string;
  updated_at: string;
  category: { name: string; slug_path: string } | null;
};

/**
 * 指定企業に紐付いた、公開済み（status='published'）記事を一覧取得。
 * /companies/{edinet}/ ページの「コンテンツ」タブで使用。
 */
export async function getPublishedArticlesForCompany(
  companyId: string
): Promise<CompanyArticle[]> {
  const sb = createSupabaseAdminClient();

  const acRes = await sb
    .from("article_companies")
    .select(
      `display_order,
       articles!inner(id, slug, title, body_html, status, updated_at, category_id,
                      article_categories(name, slug)
       )`
    )
    .eq("company_id", companyId)
    .eq("articles.status", "published")
    .order("display_order", { ascending: true });

  if (acRes.error || !acRes.data) return [];

  // 重複除去（同じ articles が複数の article_companies 行に出ない想定だが念のため）
  const seen = new Set<string>();
  const out: CompanyArticle[] = [];

  for (const row of acRes.data as any[]) {
    const a = Array.isArray(row.articles) ? row.articles[0] : row.articles;
    if (!a || !a.id || seen.has(a.id)) continue;
    seen.add(a.id);

    const cat = Array.isArray(a.article_categories)
      ? a.article_categories[0]
      : a.article_categories;

    const txt = (a.body_html ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // 表示用抜粋：85 字を超えたら末尾を「…」で省略
    const EXCERPT_MAX = 85;
    const excerpt =
      Array.from(txt).length > EXCERPT_MAX
        ? `${Array.from(txt).slice(0, EXCERPT_MAX).join("")}…`
        : txt;

    out.push({
      id: a.id as string,
      slug: (a.slug ?? null) as string | null,
      title: (a.title ?? "（無題）") as string,
      excerpt,
      updated_at: a.updated_at as string,
      category: cat
        ? { name: cat.name as string, slug_path: cat.slug as string }
        : null,
    });
  }

  // 更新日時の新しい順にソート
  out.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
  return out;
}
