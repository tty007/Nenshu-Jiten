/**
 * 08: 管理ダッシュボード用に 1日 1行のスナップショットを daily_metrics に upsert する。
 *
 * 通常運用: 引数なしで実行 → 今日の JST 日付分を計算して upsert（既に行があれば update）。
 * バックフィル: --backfill --from=YYYY-MM-DD --to=YYYY-MM-DD で指定範囲を再構築。
 *
 *   npx tsx scripts/etl/08-snapshot-daily-metrics.ts
 *   npx tsx scripts/etl/08-snapshot-daily-metrics.ts --backfill --from=2026-04-01 --to=2026-05-05
 *   npx tsx scripts/etl/08-snapshot-daily-metrics.ts --backfill --days=60
 *
 * バックフィル時のロジック:
 *   - users_total[d]    : count(auth.users where created_at < d+1)
 *   - users_new[d]      : count(auth.users where created_at on date d)
 *   - favorites_total[d]: count(user_favorites where created_at < d+1)
 *   - favorites_new[d]  : count(user_favorites where created_at on date d)
 *   - companies_total[d]: 過去の正確値は復元できないため「現在の総数」を全日に入れる近似
 *   - companies_updated[d]: count(companies where date(latest_submitted_at) = d)
 *   - users_active_24h/7d : 過去アクティブは復元不可 → 0 のまま
 *   - page_views[d]     : page_views テーブルから sum(count) where date = d
 *   - unique_paths[d]   : 同上 distinct path 数
 */
import { supabaseAdmin } from "./lib/supabase";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;

function jstDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function jstDateOf(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return jstDate(d);
}

function jstDayBoundsUtc(date: string): { startUtc: string; endUtc: string } {
  // date is YYYY-MM-DD interpreted as JST midnight
  const startUtc = new Date(`${date}T00:00:00+09:00`).toISOString();
  const endUtc = new Date(`${date}T00:00:00+09:00`);
  endUtc.setUTCDate(endUtc.getUTCDate() + 1);
  return { startUtc, endUtc: endUtc.toISOString() };
}

function parseArgs() {
  const a = process.argv.slice(2);
  let backfill = false;
  let from: string | null = null;
  let to: string | null = null;
  let days: number | null = null;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v === "--backfill") backfill = true;
    else if (v.startsWith("--from=")) from = v.slice(7);
    else if (v.startsWith("--to=")) to = v.slice(5);
    else if (v.startsWith("--days=")) days = Number(v.slice(7));
  }
  return { backfill, from, to, days };
}

async function fetchAllUsersCreatedAt(): Promise<string[]> {
  // auth.users.created_at を全件取得（タイムスタンプ列だけ）
  const out: string[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error) throw error;
    for (const u of data.users) {
      if (u.created_at) out.push(u.created_at);
    }
    if (data.users.length < PAGE_SIZE) break;
    page++;
  }
  return out;
}

async function fetchAllFavoritesCreatedAt(): Promise<string[]> {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("user_favorites")
      .select("created_at")
      .order("created_at")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as { created_at: string }[];
    for (const r of rows) out.push(r.created_at);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

async function fetchAllCompaniesSubmittedAt(): Promise<string[]> {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("latest_submitted_at")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as { latest_submitted_at: string | null }[];
    for (const r of rows) {
      if (r.latest_submitted_at) out.push(r.latest_submitted_at);
    }
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

type DailyRow = {
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

function computeForDate(args: {
  date: string;
  userCreatedDates: string[];
  favoriteCreatedDates: string[];
  companySubmittedDates: string[];
  pageViews: { count: number; uniquePaths: number } | null;
  isToday: boolean;
  userLastSignInIso: string[];
}): DailyRow {
  // date は JST 日付 (YYYY-MM-DD)
  const { date, userCreatedDates, favoriteCreatedDates, companySubmittedDates, pageViews, isToday, userLastSignInIso } = args;
  const isOnOrBefore = (d: string) => d <= date;

  const usersTotal = userCreatedDates.filter(isOnOrBefore).length;
  const usersNew = userCreatedDates.filter((d) => d === date).length;
  const favoritesTotal = favoriteCreatedDates.filter(isOnOrBefore).length;
  const favoritesNew = favoriteCreatedDates.filter((d) => d === date).length;
  const companiesUpdated = companySubmittedDates.filter((d) => d === date).length;
  // companies_total: 過去の正確な数は持っていない。「その日までに updated_at があるもの」で近似。
  // 既存スキーマでは created_at がないため、現実的には「現在の総数を全日に入れる」近似とする。
  const companiesTotal = companySubmittedDates.length;

  // active 24h / 7d は今日の場合のみ計算（過去は復元不可）
  let usersActive24h = 0;
  let usersActive7d = 0;
  if (isToday) {
    const now = Date.now();
    for (const iso of userLastSignInIso) {
      const t = Date.parse(iso);
      if (Number.isNaN(t)) continue;
      if (t >= now - DAY_MS) usersActive24h++;
      if (t >= now - 7 * DAY_MS) usersActive7d++;
    }
  }

  return {
    date,
    users_total: usersTotal,
    users_new: usersNew,
    users_active_24h: usersActive24h,
    users_active_7d: usersActive7d,
    favorites_total: favoritesTotal,
    favorites_new: favoritesNew,
    companies_total: companiesTotal,
    companies_updated: companiesUpdated,
    page_views: pageViews?.count ?? null,
    unique_paths: pageViews?.uniquePaths ?? null,
  };
}

async function fetchPageViewsByDate(dates: string[]): Promise<
  Map<string, { count: number; uniquePaths: number }>
> {
  if (dates.length === 0) return new Map();
  const min = dates.reduce((a, b) => (a < b ? a : b));
  const max = dates.reduce((a, b) => (a > b ? a : b));
  const { data, error } = await supabaseAdmin
    .from("page_views")
    .select("date, path, count")
    .gte("date", min)
    .lte("date", max);
  if (error) throw error;
  const byDate = new Map<string, { count: number; uniquePaths: number }>();
  for (const r of (data ?? []) as { date: string; path: string; count: number }[]) {
    const cur = byDate.get(r.date) ?? { count: 0, uniquePaths: 0 };
    cur.count += Number(r.count);
    cur.uniquePaths += 1;
    byDate.set(r.date, cur);
  }
  return byDate;
}

async function fetchUserLastSignIn(): Promise<string[]> {
  const out: string[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error) throw error;
    for (const u of data.users) {
      if (u.last_sign_in_at) out.push(u.last_sign_in_at);
    }
    if (data.users.length < PAGE_SIZE) break;
    page++;
  }
  return out;
}

async function snapshot(dates: string[]) {
  console.log(`[snapshot] dates=${dates.length} (${dates[0]} → ${dates[dates.length - 1]})`);
  const [users, favorites, companies, pageViewsByDate, lastSignIn] = await Promise.all([
    fetchAllUsersCreatedAt(),
    fetchAllFavoritesCreatedAt(),
    fetchAllCompaniesSubmittedAt(),
    fetchPageViewsByDate(dates),
    fetchUserLastSignIn(),
  ]);
  // タイムスタンプを JST date に変換
  const userCreatedDates = users.map((iso) => jstDateOf(iso) ?? "");
  const favoriteCreatedDates = favorites.map((iso) => jstDateOf(iso) ?? "");
  const companySubmittedDates = companies.map((iso) => jstDateOf(iso) ?? "");
  const today = jstDate();
  const rows: DailyRow[] = dates.map((d) =>
    computeForDate({
      date: d,
      userCreatedDates,
      favoriteCreatedDates,
      companySubmittedDates,
      pageViews: pageViewsByDate.get(d) ?? null,
      isToday: d === today,
      userLastSignInIso: lastSignIn,
    })
  );

  // upsert 1 件ずつだとオーバーヘッド大きいので chunk で
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin
      .from("daily_metrics")
      .upsert(chunk, { onConflict: "date" });
    if (error) throw error;
  }
  console.log(`[snapshot] upserted ${rows.length} rows`);
}

function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  // 両端含む。date を Date オブジェクトとして JST midnight 扱いで反復。
  let cur = new Date(`${from}T00:00:00+09:00`);
  const end = new Date(`${to}T00:00:00+09:00`);
  while (cur <= end) {
    out.push(jstDate(cur));
    cur = new Date(cur.getTime() + DAY_MS);
  }
  return out;
}

async function main() {
  const { backfill, from, to, days } = parseArgs();
  let dates: string[];
  if (backfill) {
    if (days) {
      const today = jstDate();
      const start = new Date(`${today}T00:00:00+09:00`);
      start.setUTCDate(start.getUTCDate() - (days - 1));
      dates = dateRange(jstDate(start), today);
    } else if (from && to) {
      dates = dateRange(from, to);
    } else if (from) {
      dates = dateRange(from, jstDate());
    } else {
      throw new Error("--backfill には --from=YYYY-MM-DD or --days=N を指定してください");
    }
  } else {
    dates = [jstDate()];
  }
  await snapshot(dates);
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
