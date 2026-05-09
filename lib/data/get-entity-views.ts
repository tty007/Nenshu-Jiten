import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * エンティティ別 PV 集計の参照ヘルパ。
 * 後の機能（人気企業ランキング・人気記事一覧・記事 PV 表示 等）から使う。
 *
 * いずれも admin client（service_role）でアクセスする。直接 anon に開放
 * すると配信戦略が外部に推測されるため、必要なら別途公開 API を用意する。
 */

function jstDateNDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function getCompanyTotalViews(
  companyId: string,
  options: { days?: number } = {}
): Promise<number> {
  const sb = createSupabaseAdminClient();
  let q = sb
    .from("company_page_views")
    .select("count")
    .eq("company_id", companyId);
  if (options.days && options.days > 0) {
    q = q.gte("date", jstDateNDaysAgo(options.days));
  }
  const { data } = await q;
  if (!data) return 0;
  return data.reduce((s, r) => s + Number((r as { count: number }).count ?? 0), 0);
}

export async function getArticleTotalViews(
  articleId: string,
  options: { days?: number } = {}
): Promise<number> {
  const sb = createSupabaseAdminClient();
  let q = sb
    .from("article_page_views")
    .select("count")
    .eq("article_id", articleId);
  if (options.days && options.days > 0) {
    q = q.gte("date", jstDateNDaysAgo(options.days));
  }
  const { data } = await q;
  if (!data) return 0;
  return data.reduce((s, r) => s + Number((r as { count: number }).count ?? 0), 0);
}

export type EntityRanking = { id: string; total: number };

export async function getTopCompaniesByViews(options: {
  limit: number;
  days?: number;
}): Promise<EntityRanking[]> {
  const sb = createSupabaseAdminClient();
  let q = sb.from("company_page_views").select("company_id, count");
  if (options.days && options.days > 0) {
    q = q.gte("date", jstDateNDaysAgo(options.days));
  }
  const { data } = await q;
  if (!data) return [];
  const totals = new Map<string, number>();
  for (const r of data as Array<{ company_id: string; count: number }>) {
    totals.set(r.company_id, (totals.get(r.company_id) ?? 0) + Number(r.count ?? 0));
  }
  return [...totals.entries()]
    .map(([id, total]) => ({ id, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, options.limit);
}

export async function getTopArticlesByViews(options: {
  limit: number;
  days?: number;
}): Promise<EntityRanking[]> {
  const sb = createSupabaseAdminClient();
  let q = sb.from("article_page_views").select("article_id, count");
  if (options.days && options.days > 0) {
    q = q.gte("date", jstDateNDaysAgo(options.days));
  }
  const { data } = await q;
  if (!data) return [];
  const totals = new Map<string, number>();
  for (const r of data as Array<{ article_id: string; count: number }>) {
    totals.set(r.article_id, (totals.get(r.article_id) ?? 0) + Number(r.count ?? 0));
  }
  return [...totals.entries()]
    .map(([id, total]) => ({ id, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, options.limit);
}
