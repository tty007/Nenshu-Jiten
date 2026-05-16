import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * 管理ダッシュボード向けの PV 集計クエリ群。
 *
 * 設計：
 *   - daily_metrics は JST 03:00 のスナップショットなので「今日」「直近の更新」が
 *     反映されない → ダッシュボードでは生の page_views / *_page_views から
 *     直接集計する。
 *   - 全クエリは React `cache` でリクエストスコープにメモ化。
 *   - 同じ admin SSR レンダ内で複数回呼ばれても DB 往復は 1 回。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function jstDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * 直近 N 日（JST 当日含む）の日別合計 PV。`page_views` テーブルを
 * date でグルーピングして返す。チャート系列の `pageViews` ソース。
 */
export const getDailyPageViewsLive = cache(
  async (days: number = 30): Promise<Map<string, number>> => {
    const sb = createSupabaseAdminClient();
    const today = jstDate();
    const since = jstDate(new Date(Date.now() - (days - 1) * DAY_MS));
    const { data, error } = await sb
      .from("page_views")
      .select("date, count")
      .gte("date", since)
      .lte("date", today);
    if (error) {
      console.error("[getDailyPageViewsLive] page_views select:", error.message);
      return new Map();
    }
    const byDate = new Map<string, number>();
    for (const r of (data ?? []) as { date: string; count: number }[]) {
      byDate.set(r.date, (byDate.get(r.date) ?? 0) + Number(r.count));
    }
    return byDate;
  }
);

/** 直近 N 日の合計 PV と現在 / 24h / 7d の概況 */
export type PageViewSummary = {
  totalLastNDays: number;
  totalToday: number;
  totalLast7d: number;
  uniquePathsLastNDays: number;
};

export const getPageViewSummary = cache(
  async (days: number = 30): Promise<PageViewSummary> => {
    const sb = createSupabaseAdminClient();
    const today = jstDate();
    const since = jstDate(new Date(Date.now() - (days - 1) * DAY_MS));
    const since7 = jstDate(new Date(Date.now() - 6 * DAY_MS));
    const { data, error } = await sb
      .from("page_views")
      .select("date, path, count")
      .gte("date", since)
      .lte("date", today);
    if (error) {
      console.error("[getPageViewSummary] page_views select:", error.message);
      return {
        totalLastNDays: 0,
        totalToday: 0,
        totalLast7d: 0,
        uniquePathsLastNDays: 0,
      };
    }
    let totalLastNDays = 0;
    let totalToday = 0;
    let totalLast7d = 0;
    const paths = new Set<string>();
    for (const r of (data ?? []) as {
      date: string;
      path: string;
      count: number;
    }[]) {
      const c = Number(r.count);
      totalLastNDays += c;
      if (r.date === today) totalToday += c;
      if (r.date >= since7) totalLast7d += c;
      paths.add(r.path);
    }
    return {
      totalLastNDays,
      totalToday,
      totalLast7d,
      uniquePathsLastNDays: paths.size,
    };
  }
);

/** path 別ランキング（直近 N 日合計）。 */
export type TopPathRow = { path: string; count: number };

export const getTopPagesByPath = cache(
  async (days: number = 30, limit: number = 20): Promise<TopPathRow[]> => {
    const sb = createSupabaseAdminClient();
    const today = jstDate();
    const since = jstDate(new Date(Date.now() - (days - 1) * DAY_MS));
    const { data, error } = await sb
      .from("page_views")
      .select("path, count")
      .gte("date", since)
      .lte("date", today);
    if (error) {
      console.error("[getTopPagesByPath] page_views select:", error.message);
      return [];
    }
    const byPath = new Map<string, number>();
    for (const r of (data ?? []) as { path: string; count: number }[]) {
      byPath.set(r.path, (byPath.get(r.path) ?? 0) + Number(r.count));
    }
    return [...byPath.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([path, count]) => ({ path, count }));
  }
);

export type TopCompanyViewRow = {
  companyId: string;
  edinetCode: string;
  name: string;
  count: number;
};

/** company_page_views から企業ページ別ランキング（直近 N 日）。 */
export const getTopCompaniesByViews = cache(
  async (
    days: number = 30,
    limit: number = 10
  ): Promise<TopCompanyViewRow[]> => {
    const sb = createSupabaseAdminClient();
    const today = jstDate();
    const since = jstDate(new Date(Date.now() - (days - 1) * DAY_MS));
    const { data, error } = await sb
      .from("company_page_views")
      .select("company_id, count, companies(id, name, edinet_code)")
      .gte("date", since)
      .lte("date", today);
    if (error) {
      console.error("[getTopCompaniesByViews] select:", error.message);
      return [];
    }
    type Row = {
      company_id: string;
      count: number;
      companies:
        | { id: string; name: string; edinet_code: string }
        | { id: string; name: string; edinet_code: string }[]
        | null;
    };
    const byCompany = new Map<
      string,
      { name: string; edinetCode: string; count: number }
    >();
    for (const r of (data as Row[] | null) ?? []) {
      const comp = Array.isArray(r.companies) ? r.companies[0] : r.companies;
      if (!comp) continue;
      const cur = byCompany.get(r.company_id) ?? {
        name: comp.name,
        edinetCode: comp.edinet_code,
        count: 0,
      };
      cur.count += Number(r.count);
      byCompany.set(r.company_id, cur);
    }
    return [...byCompany.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([companyId, v]) => ({
        companyId,
        edinetCode: v.edinetCode,
        name: v.name,
        count: v.count,
      }));
  }
);

export type TopArticleViewRow = {
  articleId: string;
  slug: string | null;
  title: string;
  count: number;
};

/** article_page_views から記事ページ別ランキング（直近 N 日）。 */
export const getTopArticlesByViews = cache(
  async (
    days: number = 30,
    limit: number = 10
  ): Promise<TopArticleViewRow[]> => {
    const sb = createSupabaseAdminClient();
    const today = jstDate();
    const since = jstDate(new Date(Date.now() - (days - 1) * DAY_MS));
    const { data, error } = await sb
      .from("article_page_views")
      .select("article_id, count, articles(id, title, slug)")
      .gte("date", since)
      .lte("date", today);
    if (error) {
      console.error("[getTopArticlesByViews] select:", error.message);
      return [];
    }
    type Row = {
      article_id: string;
      count: number;
      articles:
        | { id: string; title: string | null; slug: string | null }
        | { id: string; title: string | null; slug: string | null }[]
        | null;
    };
    const byArticle = new Map<
      string,
      { title: string; slug: string | null; count: number }
    >();
    for (const r of (data as Row[] | null) ?? []) {
      const art = Array.isArray(r.articles) ? r.articles[0] : r.articles;
      if (!art) continue;
      const cur = byArticle.get(r.article_id) ?? {
        title: art.title ?? "(無題)",
        slug: art.slug,
        count: 0,
      };
      cur.count += Number(r.count);
      byArticle.set(r.article_id, cur);
    }
    return [...byArticle.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([articleId, v]) => ({
        articleId,
        slug: v.slug,
        title: v.title,
        count: v.count,
      }));
  }
);
