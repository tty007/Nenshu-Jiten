import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 1000;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

/**
 * auth.users を全件ページングで取得（service_role）。
 * 集計のために 1 度全部取り出すのは非効率だが、現状ユーザー数が少ない（< 数千）ので
 * 許容範囲。スケール時は SQL VIEW + count に置き換える。
 */
async function fetchAllUsers() {
  const sb = createSupabaseAdminClient();
  type AuthUserMin = {
    id: string;
    email: string | null;
    created_at: string | null;
    last_sign_in_at: string | null;
    email_confirmed_at: string | null;
  };
  const out: AuthUserMin[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error) throw error;
    for (const u of data.users) {
      out.push({
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
      });
    }
    if (data.users.length < PAGE_SIZE) break;
    page++;
  }
  return out;
}

const _allUsersCache = cache(fetchAllUsers);

export type UserStats = {
  total: number;
  newLast7d: number;
  activeLast24h: number;
  activeLast30d: number;
  emailConfirmedRate: number; // 0-100
  profileCompletedRate: number; // 0-100
};

const PROFILE_REQUIRED_FIELDS = [
  "nickname",
  "birth_year",
  "gender",
  "prefecture",
  "career_status",
  "salary_band",
] as const;

export const getUserStats = cache(async (): Promise<UserStats> => {
  const sb = createSupabaseAdminClient();
  const users = await _allUsersCache();
  const total = users.length;
  const sevenDaysAgo = Date.now() - 7 * DAY_MS;
  const dayAgo = Date.now() - DAY_MS;
  const thirtyDaysAgo = Date.now() - 30 * DAY_MS;

  let newLast7d = 0;
  let activeLast24h = 0;
  let activeLast30d = 0;
  let emailConfirmed = 0;
  for (const u of users) {
    if (u.email_confirmed_at) emailConfirmed++;
    const created = u.created_at ? Date.parse(u.created_at) : 0;
    if (created && created >= sevenDaysAgo) newLast7d++;
    const lastSignIn = u.last_sign_in_at ? Date.parse(u.last_sign_in_at) : 0;
    if (lastSignIn && lastSignIn >= dayAgo) activeLast24h++;
    if (lastSignIn && lastSignIn >= thirtyDaysAgo) activeLast30d++;
  }

  // profile completed: user_profiles で 6 項目が全て埋まっている人数
  const { data: profiles } = await sb
    .from("user_profiles")
    .select(
      "user_id, nickname, birth_year, gender, prefecture, career_status, salary_band"
    );
  let profileCompleted = 0;
  for (const p of (profiles ?? []) as unknown as Record<string, unknown>[]) {
    if (PROFILE_REQUIRED_FIELDS.every((f) => p[f] !== null)) {
      profileCompleted++;
    }
  }
  return {
    total,
    newLast7d,
    activeLast24h,
    activeLast30d,
    emailConfirmedRate: total ? (emailConfirmed / total) * 100 : 0,
    profileCompletedRate: total ? (profileCompleted / total) * 100 : 0,
  };
});

export type DailyCount = { date: string; count: number };

export const getDailySignups = cache(
  async (days: number = 30): Promise<DailyCount[]> => {
    const users = await _allUsersCache();
    const buckets = new Map<string, number>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * DAY_MS);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const u of users) {
      if (!u.created_at) continue;
      const key = u.created_at.slice(0, 10); // YYYY-MM-DD
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    }
    return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
  }
);

export type CompanyStats = {
  total: number;
  withSalary: number; // 平均年収あり
  withSummary: number; // AI 概要あり
  withGbizinfo: number; // 法人番号あり
  recentlyUpdatedCount: number; // 直近30日
};

export const getCompanyStats = cache(async (): Promise<CompanyStats> => {
  const sb = createSupabaseAdminClient();
  const thirtyDaysAgo = isoDaysAgo(30);
  const [total, withSalary, withSummary, withGbiz, recentUpd] = await Promise.all([
    sb.from("companies").select("id", { head: true, count: "exact" }),
    sb
      .from("companies")
      .select("id", { head: true, count: "exact" })
      .not("latest_avg_salary", "is", null),
    sb
      .from("companies")
      .select("id", { head: true, count: "exact" })
      .not("summary", "is", null),
    sb
      .from("companies")
      .select("id", { head: true, count: "exact" })
      .not("corporate_number", "is", null),
    sb
      .from("companies")
      .select("id", { head: true, count: "exact" })
      .gte("latest_submitted_at", thirtyDaysAgo),
  ]);
  return {
    total: total.count ?? 0,
    withSalary: withSalary.count ?? 0,
    withSummary: withSummary.count ?? 0,
    withGbizinfo: withGbiz.count ?? 0,
    recentlyUpdatedCount: recentUpd.count ?? 0,
  };
});

export type EtlHealth = {
  lastIngestAt: string | null;
  lastIngestDocId: string | null;
  parsedLast7d: number;
  parseErrorsLast30d: number;
};

export const getEtlHealth = cache(async (): Promise<EtlHealth> => {
  const sb = createSupabaseAdminClient();
  const sevenDaysAgo = isoDaysAgo(7);
  const thirtyDaysAgo = isoDaysAgo(30);
  const [lastIngest, parsed7, errors30] = await Promise.all([
    sb
      .from("raw_xbrl_documents")
      .select("doc_id, parsed_at")
      .not("parsed_at", "is", null)
      .order("parsed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("raw_xbrl_documents")
      .select("doc_id", { head: true, count: "exact" })
      .gte("parsed_at", sevenDaysAgo),
    sb
      .from("raw_xbrl_documents")
      .select("doc_id", { head: true, count: "exact" })
      .not("parse_error", "is", null)
      .gte("submitted_at", thirtyDaysAgo),
  ]);
  return {
    lastIngestAt:
      (lastIngest.data as { parsed_at?: string } | null)?.parsed_at ?? null,
    lastIngestDocId:
      (lastIngest.data as { doc_id?: string } | null)?.doc_id ?? null,
    parsedLast7d: parsed7.count ?? 0,
    parseErrorsLast30d: errors30.count ?? 0,
  };
});

export type EngagementStats = {
  totalFavorites: number;
  avgFavoritesPerUser: number;
  topCompanies: { id: string; edinetCode: string; name: string; count: number }[];
};

export const getEngagementStats = cache(
  async (): Promise<EngagementStats> => {
    const sb = createSupabaseAdminClient();
    const [{ count: totalFavorites }, allFavs] = await Promise.all([
      sb.from("user_favorites").select("user_id", { head: true, count: "exact" }),
      sb
        .from("user_favorites")
        .select(`company_id, companies!inner(id, edinet_code, name)`),
    ]);
    type Row = {
      company_id: string;
      companies: { id: string; edinet_code: string; name: string };
    };
    const rows = (allFavs.data as unknown as Row[]) ?? [];
    const usersTotal = await _allUsersCache();
    // 集計
    const byCompany = new Map<
      string,
      { id: string; edinetCode: string; name: string; count: number }
    >();
    for (const r of rows) {
      const c = byCompany.get(r.company_id);
      if (c) c.count++;
      else
        byCompany.set(r.company_id, {
          id: r.companies.id,
          edinetCode: r.companies.edinet_code,
          name: r.companies.name,
          count: 1,
        });
    }
    const top = Array.from(byCompany.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    return {
      totalFavorites: totalFavorites ?? 0,
      avgFavoritesPerUser:
        usersTotal.length > 0 ? (totalFavorites ?? 0) / usersTotal.length : 0,
      topCompanies: top,
    };
  }
);

export type DataCompleteness = {
  total: number;
  rows: { key: string; label: string; count: number }[];
};

export const getDataCompleteness = cache(
  async (): Promise<DataCompleteness> => {
    const sb = createSupabaseAdminClient();
    const head = (col: string, op: "not_null") =>
      sb
        .from("companies")
        .select("id", { head: true, count: "exact" })
        .not(col, "is", null);
    const [
      total,
      cn,
      foundedAt,
      website,
      capital,
      representative,
      summary,
      avgSalary,
      tenure,
    ] = await Promise.all([
      sb.from("companies").select("id", { head: true, count: "exact" }),
      head("corporate_number", "not_null"),
      head("founded_at", "not_null"),
      head("website_url", "not_null"),
      head("capital_stock_yen", "not_null"),
      head("representative", "not_null"),
      head("summary", "not_null"),
      head("latest_avg_salary", "not_null"),
      head("latest_tenure_years", "not_null"),
    ]);
    return {
      total: total.count ?? 0,
      rows: [
        { key: "corporate_number", label: "法人番号", count: cn.count ?? 0 },
        { key: "founded_at", label: "設立日", count: foundedAt.count ?? 0 },
        { key: "website_url", label: "公式 HP", count: website.count ?? 0 },
        { key: "capital_stock_yen", label: "資本金", count: capital.count ?? 0 },
        {
          key: "representative",
          label: "代表者",
          count: representative.count ?? 0,
        },
        { key: "summary", label: "AI 概要", count: summary.count ?? 0 },
        { key: "latest_avg_salary", label: "平均年収", count: avgSalary.count ?? 0 },
        {
          key: "latest_tenure_years",
          label: "勤続年数",
          count: tenure.count ?? 0,
        },
      ],
    };
  }
);

export type RecentCompany = {
  id: string;
  edinetCode: string;
  name: string;
  industryName: string | null;
  latestSubmittedAt: string | null;
};

export const getRecentlyUpdatedCompanies = cache(
  async (limit: number = 20): Promise<RecentCompany[]> => {
    const sb = createSupabaseAdminClient();
    const { data } = await sb
      .from("companies")
      .select(
        "id, edinet_code, name, latest_submitted_at, industries(name)"
      )
      .not("latest_submitted_at", "is", null)
      .order("latest_submitted_at", { ascending: false })
      .limit(limit);
    type Row = {
      id: string;
      edinet_code: string;
      name: string;
      latest_submitted_at: string | null;
      industries: { name: string | null } | null;
    };
    return ((data as unknown as Row[]) ?? []).map((r) => ({
      id: r.id,
      edinetCode: r.edinet_code,
      name: r.name,
      industryName: r.industries?.name ?? null,
      latestSubmittedAt: r.latest_submitted_at,
    }));
  }
);

export type Bucket = { label: string; count: number };

/** ユーザー属性の集計（業種・年収帯・都道府県・キャリア） */
export const getUserSegmentStats = cache(async () => {
  const sb = createSupabaseAdminClient();
  const { data } = await sb
    .from("user_profiles")
    .select("birth_year, gender, prefecture, career_status, salary_band");
  type Row = {
    birth_year: number | null;
    gender: string | null;
    prefecture: string | null;
    career_status: string | null;
    salary_band: string | null;
  };
  const rows = (data as Row[]) ?? [];
  function bucketize(getter: (r: Row) => string | null): Bucket[] {
    const m = new Map<string, number>();
    for (const r of rows) {
      const v = getter(r);
      if (!v) continue;
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }
  return {
    byPrefecture: bucketize((r) => r.prefecture).slice(0, 10),
    byCareerStatus: bucketize((r) => r.career_status),
    byGender: bucketize((r) => r.gender),
    bySalaryBand: bucketize((r) => r.salary_band),
  };
});
