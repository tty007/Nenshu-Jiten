import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublishedArticle = {
  id: string;
  slug: string | null;
  title: string;
  body_html: string;
  created_at: string;
  updated_at: string;
  author: {
    name: string;
    slug: string;
    bio: string | null;
    avatar_url: string | null;
  } | null;
  companies: Array<{
    id: string;
    edinet_code: string;
    name: string;
    industry_name: string | null;
  }>;
};

/** UUID ぽい文字列か */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * status='published' の記事のみ返す。引数は UUID でも slug でも OK。
 * 該当なし（draft / archived / 存在せず）は null。
 */
export async function getPublishedArticle(
  idOrSlug: string
): Promise<PublishedArticle | null> {
  const sb = createSupabaseAdminClient();

  const isUuid = UUID_PATTERN.test(idOrSlug);
  const baseSelect =
    "id, slug, title, body_html, status, author_id, created_at, updated_at";

  let aRes;
  if (isUuid) {
    aRes = await sb
      .from("articles")
      .select(baseSelect)
      .eq("id", idOrSlug)
      .eq("status", "published")
      .maybeSingle();
  } else {
    aRes = await sb
      .from("articles")
      .select(baseSelect)
      .eq("slug", idOrSlug)
      .eq("status", "published")
      .maybeSingle();
  }
  if (aRes.error || !aRes.data) return null;
  const id = aRes.data.id as string;

  const acRes = await sb
    .from("article_companies")
    .select(
      `display_order, companies(id, edinet_code, name, industries(name))`
    )
    .eq("article_id", id)
    .order("display_order", { ascending: true });
  void id;

  const companies = (acRes.data ?? []).map((r: any) => {
    const c = r.companies;
    const ind = Array.isArray(c?.industries) ? c.industries[0] : c?.industries;
    return {
      id: c?.id as string,
      edinet_code: c?.edinet_code as string,
      name: c?.name as string,
      industry_name: ind?.name ?? null,
    };
  });

  // 著者（アクティブな場合のみ）
  let author: PublishedArticle["author"] = null;
  const authorId = (aRes.data.author_id ?? null) as string | null;
  if (authorId) {
    const auRes = await sb
      .from("article_authors")
      .select("name, slug, bio, avatar_url, is_active")
      .eq("id", authorId)
      .maybeSingle();
    if (!auRes.error && auRes.data && auRes.data.is_active) {
      author = {
        name: auRes.data.name as string,
        slug: auRes.data.slug as string,
        bio: (auRes.data.bio ?? null) as string | null,
        avatar_url: (auRes.data.avatar_url ?? null) as string | null,
      };
    }
  }

  return {
    id,
    slug: (aRes.data.slug ?? null) as string | null,
    title: (aRes.data.title ?? "") as string,
    body_html: (aRes.data.body_html ?? "") as string,
    created_at: aRes.data.created_at as string,
    updated_at: aRes.data.updated_at as string,
    author,
    companies,
  };
}

export type PublishedArticleSitemapRow = {
  slugOrId: string;
  updated_at: string;
};

/** sitemap.xml 用に status='published' の記事一覧を返す。slug があれば slug、無ければ id を URL セグメントに使う */
export async function getPublishedArticlesForSitemap(): Promise<
  PublishedArticleSitemapRow[]
> {
  const sb = createSupabaseAdminClient();
  const { data, error } = await sb
    .from("articles")
    .select("id, slug, updated_at")
    .eq("status", "published");
  if (error || !data) return [];
  return (data as Array<{ id: string; slug: string | null; updated_at: string }>).map(
    (a) => ({
      slugOrId: a.slug ?? a.id,
      updated_at: a.updated_at,
    }),
  );
}
