import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DailyMetric = {
  date: string;
  usersTotal: number;
  usersNew: number;
  usersActive24h: number;
  usersActive7d: number;
  favoritesTotal: number;
  favoritesNew: number;
  companiesTotal: number;
  companiesUpdated: number;
  pageViews: number | null;
  uniquePaths: number | null;
};

export const getDailyMetrics = cache(
  async (days: number = 30): Promise<DailyMetric[]> => {
    const sb = createSupabaseAdminClient();
    const { data } = await sb
      .from("daily_metrics")
      .select(
        "date, users_total, users_new, users_active_24h, users_active_7d, favorites_total, favorites_new, companies_total, companies_updated, page_views, unique_paths"
      )
      .order("date", { ascending: true })
      .limit(days);
    type Row = {
      date: string;
      users_total: number;
      users_new: number;
      users_active_24h: number;
      users_active_7d: number;
      favorites_total: number;
      favorites_new: number;
      companies_total: number;
      companies_updated: number;
      page_views: number | null;
      unique_paths: number | null;
    };
    const rows = (data as Row[] | null) ?? [];
    // 直近 N 件にトリム（昇順クエリで limit するとブランクが多い時に古い分から切られるので
    // ここでは date desc で N 件取って reverse する方式が望ましい）
    const sliced = rows.slice(-days);
    return sliced.map((r) => ({
      date: r.date,
      usersTotal: r.users_total,
      usersNew: r.users_new,
      usersActive24h: r.users_active_24h,
      usersActive7d: r.users_active_7d,
      favoritesTotal: r.favorites_total,
      favoritesNew: r.favorites_new,
      companiesTotal: r.companies_total,
      companiesUpdated: r.companies_updated,
      pageViews: r.page_views,
      uniquePaths: r.unique_paths,
    }));
  }
);
