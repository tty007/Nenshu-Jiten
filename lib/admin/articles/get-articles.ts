import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ArticleStatus = "draft" | "published" | "archived";

/**
 * 空の draft 記事を作成して ID を返す（純粋な DB 操作、revalidatePath を呼ばない）。
 * Server Component の render 中から直接呼べる（/admin/articles/new など）。
 *
 * Server Action からも actions.ts の createArticle が薄ラッパとして利用する。
 */
export async function createArticleRecord(opts: {
  authorId?: string | null;
  initialCompanyIds?: string[];
}): Promise<{ id: string } | { error: string }> {
  const sb = createSupabaseAdminClient();

  // author_id は article_authors テーブルへの FK。
  // 作成時は未設定とし、エディタの AuthorSelector から明示的に紐付ける運用。
  const ins = await sb
    .from("articles")
    .insert({
      title: "",
      body_html: "",
      body_json: null,
      status: "draft",
      author_id: opts.authorId ?? null,
    })
    .select("id")
    .single();
  if (ins.error) return { error: ins.error.message };
  const articleId = ins.data.id as string;

  if (opts.initialCompanyIds && opts.initialCompanyIds.length > 0) {
    const rows = opts.initialCompanyIds.map((cid, idx) => ({
      article_id: articleId,
      company_id: cid,
      display_order: idx,
    }));
    const ac = await sb.from("article_companies").insert(rows);
    if (ac.error) {
      // ロールバック
      await sb.from("articles").delete().eq("id", articleId);
      return { error: ac.error.message };
    }
  }

  return { id: articleId };
}

export type ArticleListRow = {
  id: string;
  title: string;
  status: ArticleStatus;
  updated_at: string;
  created_at: string;
  company_count: number;
  companies: Array<{ id: string; name: string; edinet_code: string }>;
};

export type ArticleDetail = {
  id: string;
  title: string;
  body_html: string;
  body_json: unknown | null;
  status: ArticleStatus;
  author_id: string | null;
  category_id: string | null;
  slug: string | null;
  created_at: string;
  updated_at: string;
  companies: Array<{
    id: string;
    edinet_code: string;
    name: string;
    industry_name: string | null;
    display_order: number;
  }>;
  xbrl_documents: Array<{
    doc_id: string;
    edinet_code: string | null;
    fiscal_year: number | null;
    submitted_at: string | null;
    filer_name: string | null;
    display_order: number;
  }>;
};

/**
 * 記事一覧（管理画面用、全 status 取得）
 */
export async function listArticles(opts: {
  status?: ArticleStatus | "all";
  companyId?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ rows: ArticleListRow[]; total: number }> {
  const sb = createSupabaseAdminClient();
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));
  const offset = Math.max(0, opts.offset ?? 0);

  let q = sb
    .from("articles")
    .select(
      `id, title, status, created_at, updated_at,
       article_companies(
         display_order,
         companies(id, name, edinet_code)
       )`,
      { count: "exact" }
    )
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);

  // 特定企業に紐づく記事だけ
  if (opts.companyId) {
    // article_companies 経由でフィルタ：先に article_id 群を取得して in
    const acRes = await sb
      .from("article_companies")
      .select("article_id")
      .eq("company_id", opts.companyId);
    if (acRes.error) throw acRes.error;
    const ids = (acRes.data ?? []).map((r) => r.article_id as string);
    if (ids.length === 0) return { rows: [], total: 0 };
    q = q.in("id", ids);
  }

  const res = await q;
  if (res.error) throw res.error;

  const rows: ArticleListRow[] = (res.data ?? []).map((r: any) => {
    const companies = ((r.article_companies as any[]) ?? [])
      .map((ac: any) => ({
        id: ac.companies?.id ?? null,
        name: ac.companies?.name ?? null,
        edinet_code: ac.companies?.edinet_code ?? null,
        display_order: ac.display_order ?? 0,
      }))
      .filter((c) => c.id)
      .sort((a, b) => a.display_order - b.display_order);
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      company_count: companies.length,
      companies: companies.map(({ id, name, edinet_code }) => ({
        id,
        name,
        edinet_code,
      })),
    };
  });

  return { rows, total: res.count ?? 0 };
}

/**
 * 1 記事の詳細（編集画面用）
 */
export async function getArticleDetail(
  id: string
): Promise<ArticleDetail | null> {
  const sb = createSupabaseAdminClient();
  const aRes = await sb
    .from("articles")
    .select(
      "id, title, body_html, body_json, status, author_id, category_id, slug, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (aRes.error || !aRes.data) return null;

  const acRes = await sb
    .from("article_companies")
    .select(
      `display_order,
       companies(id, edinet_code, name, industries(name))`
    )
    .eq("article_id", id)
    .order("display_order", { ascending: true });
  if (acRes.error) throw acRes.error;

  const companies = (acRes.data ?? []).map((r: any) => {
    const c = r.companies;
    const ind = Array.isArray(c?.industries) ? c.industries[0] : c?.industries;
    return {
      id: c?.id as string,
      edinet_code: c?.edinet_code as string,
      name: c?.name as string,
      industry_name: ind?.name ?? null,
      display_order: r.display_order as number,
    };
  });

  // 紐付き有報書類
  const xRes = await sb
    .from("article_xbrl_documents")
    .select(
      "doc_id, edinet_code, fiscal_year, submitted_at, filer_name, display_order"
    )
    .eq("article_id", id)
    .order("display_order", { ascending: true })
    .order("submitted_at", { ascending: false });
  if (xRes.error) throw xRes.error;
  const xbrl_documents = (xRes.data ?? []).map((r: any) => ({
    doc_id: r.doc_id as string,
    edinet_code: (r.edinet_code ?? null) as string | null,
    fiscal_year: (r.fiscal_year ?? null) as number | null,
    submitted_at: (r.submitted_at ?? null) as string | null,
    filer_name: (r.filer_name ?? null) as string | null,
    display_order: (r.display_order ?? 0) as number,
  }));

  return {
    id: aRes.data.id as string,
    title: (aRes.data.title ?? "") as string,
    body_html: (aRes.data.body_html ?? "") as string,
    body_json: aRes.data.body_json ?? null,
    status: aRes.data.status as ArticleStatus,
    author_id: (aRes.data.author_id ?? null) as string | null,
    category_id: (aRes.data.category_id ?? null) as string | null,
    slug: (aRes.data.slug ?? null) as string | null,
    created_at: aRes.data.created_at as string,
    updated_at: aRes.data.updated_at as string,
    companies,
    xbrl_documents,
  };
}

/**
 * 軽量：エディタ画面の企業セレクタの検索用
 */
export async function searchCompaniesForEditor(query: string, limit = 20) {
  const sb = createSupabaseAdminClient();
  const q = query.trim();
  if (!q) return [];
  const esc = q.replace(/[%_,]/g, " ");
  const res = await sb
    .from("companies")
    .select("id, edinet_code, name, name_kana, industry_code, industries(name)")
    .or(
      `name.ilike.%${esc}%,name_kana.ilike.%${esc}%,edinet_code.ilike.%${esc}%,securities_code.ilike.%${esc}%`
    )
    .order("name", { ascending: true })
    .limit(limit);
  if (res.error) throw res.error;
  return (res.data ?? []).map((c: any) => {
    const ind = Array.isArray(c.industries) ? c.industries[0] : c.industries;
    return {
      id: c.id as string,
      edinet_code: c.edinet_code as string,
      name: c.name as string,
      name_kana: (c.name_kana ?? null) as string | null,
      industry_name: ind?.name ?? null,
    };
  });
}

/**
 * companyId(uuid) リストから 表示用情報を取得（new 画面で companyId 初期選択する時に使用）
 */
export async function getCompaniesByIds(ids: string[]) {
  const sb = createSupabaseAdminClient();
  if (ids.length === 0) return [];
  const res = await sb
    .from("companies")
    .select("id, edinet_code, name, industries(name)")
    .in("id", ids);
  if (res.error) throw res.error;
  return (res.data ?? []).map((c: any) => {
    const ind = Array.isArray(c.industries) ? c.industries[0] : c.industries;
    return {
      id: c.id as string,
      edinet_code: c.edinet_code as string,
      name: c.name as string,
      industry_name: ind?.name ?? null,
      display_order: 0,
    };
  });
}
