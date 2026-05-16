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
    // date desc で直近 N 件を取り、表示用に昇順へ戻す。
    // （昇順 + limit だと「最古から N 件」になるので、daily_metrics が
    //  積み上がると古い日付しか出ない既知バグの修正）
    const { data } = await sb
      .from("daily_metrics")
      .select(
        "date, users_total, users_new, users_active_24h, users_active_7d, favorites_total, favorites_new, companies_total, companies_updated, page_views, unique_paths"
      )
      .order("date", { ascending: false })
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
    const ascending = rows.slice().reverse();
    return ascending.map((r) => ({
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
 * チャート描画用に「直近 N 日（必ず今日を末尾に含む）」の固定軸を作る。
 * daily_metrics のスナップショットには今日の行が無いケース（朝の cron 前）
 * があるが、それでも今日の生 PV を表示できるようにキー揃えする。
 */
export function buildContiguousDateAxis(days: number): string[] {
  const today = jstDate();
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(jstDate(new Date(Date.parse(`${today}T00:00:00+09:00`) - i * DAY_MS)));
  }
  return out;
}
