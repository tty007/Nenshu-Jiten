import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import type {
  Company,
  CompanyWithLatestMetrics,
  FinancialMetric,
  Industry,
} from "@/types";
import { brandColorFor } from "./brand-color";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

type DbCompany = {
  id: string;
  edinet_code: string;
  securities_code: string | null;
  name: string;
  name_kana: string | null;
  industry_code: string | null;
  listed_market: string | null;
  description: string | null;
  summary: string | null;
  summary_generated_at: string | null;
  summary_source_doc_id: string | null;
  website_url: string | null;
  headquarters: string | null;
  founded_year: number | null;
  founded_at: string | null;
  representative: string | null;
  corporate_number: string | null;
  capital_stock_yen: number | string | null;
  fiscal_year_end_month: number | null;
  logo_url: string | null;
  cover_image_url: string | null;
  industries: { code: string; name: string } | null;
};

type DbMetric = {
  company_id: string;
  fiscal_year: number;
  average_annual_salary: number | null;
  average_age: number | string | null;
  average_tenure_years: number | string | null;
  employee_count: number | null;
  female_manager_ratio: number | string | null;
  average_overtime_hours: number | string | null;
  revenue: number | null;
  operating_income: number | null;
  ordinary_income: number | null;
  net_income: number | null;
  doc_id: string | null;
  submitted_at: string | null;
};

const COMPANY_SELECT =
  "id, edinet_code, securities_code, name, name_kana, industry_code, listed_market, description, summary, summary_generated_at, summary_source_doc_id, website_url, headquarters, founded_year, founded_at, representative, corporate_number, capital_stock_yen, fiscal_year_end_month, logo_url, cover_image_url, industries(code, name)";

const METRIC_SELECT =
  "company_id, fiscal_year, average_annual_salary, average_age, average_tenure_years, employee_count, female_manager_ratio, average_overtime_hours, revenue, operating_income, ordinary_income, net_income, doc_id, submitted_at";

function num(v: number | string | null): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapCompany(c: DbCompany): Company {
  const industryCode = c.industry_code;
  const industryName = c.industries?.name ?? null;
  const market = c.listed_market;
  const listedMarket =
    market === "プライム" || market === "スタンダード" || market === "グロース"
      ? market
      : null;
  return {
    id: c.id,
    edinetCode: c.edinet_code,
    securitiesCode: c.securities_code,
    name: c.name,
    nameKana: c.name_kana,
    industryCode,
    industryName,
    listedMarket,
    description: c.description,
    summary: c.summary,
    summaryGeneratedAt: c.summary_generated_at,
    summarySourceDocId: c.summary_source_doc_id,
    websiteUrl: c.website_url,
    headquarters: c.headquarters,
    foundedYear: c.founded_year,
    foundedAt: c.founded_at,
    representative: c.representative,
    corporateNumber: c.corporate_number,
    capitalStockYen: num(c.capital_stock_yen),
    fiscalYearEndMonth: c.fiscal_year_end_month,
    logoUrl: c.logo_url,
    brandColor: brandColorFor(industryCode),
    coverImageUrl: c.cover_image_url,
  };
}

function mapMetric(m: DbMetric): FinancialMetric {
  return {
    companyId: m.company_id,
    fiscalYear: m.fiscal_year,
    averageAnnualSalary: m.average_annual_salary,
    averageAge: num(m.average_age),
    averageTenureYears: num(m.average_tenure_years),
    employeeCount: m.employee_count,
    femaleManagerRatio: num(m.female_manager_ratio),
    averageOvertimeHours: num(m.average_overtime_hours),
    revenue: m.revenue,
    operatingIncome: m.operating_income,
    ordinaryIncome: m.ordinary_income,
    netIncome: m.net_income,
    docId: m.doc_id,
    submittedAt: m.submitted_at,
  };
}

function combine(
  companies: DbCompany[],
  metrics: DbMetric[]
): CompanyWithLatestMetrics[] {
  const byCompany = new Map<string, FinancialMetric[]>();
  for (const m of metrics) {
    const arr = byCompany.get(m.company_id) ?? [];
    arr.push(mapMetric(m));
    byCompany.set(m.company_id, arr);
  }
  const out: CompanyWithLatestMetrics[] = [];
  for (const c of companies) {
    const history = (byCompany.get(c.id) ?? []).sort(
      (a, b) => a.fiscalYear - b.fiscalYear
    );
    if (history.length === 0) continue;
    const latest = computeLatestWithFallback(history);
    out.push({ ...mapCompany(c), latest, history });
  }
  return out;
}

// 直近年度のレコードを基準にしつつ、null フィールドは過去年度の最新非NULL値で補完する。
// 「最新年度に平均年収だけ載っていない」ようなケースでも、ヒーロー指標がブランクにならない。
function computeLatestWithFallback(
  historyAsc: FinancialMetric[]
): FinancialMetric {
  const latest: FinancialMetric = { ...historyAsc[historyAsc.length - 1] };
  const FALLBACK_FIELDS: Array<keyof FinancialMetric> = [
    "averageAnnualSalary",
    "averageAge",
    "averageTenureYears",
    "employeeCount",
    "femaleManagerRatio",
    "averageOvertimeHours",
    "revenue",
    "operatingIncome",
    "ordinaryIncome",
    "netIncome",
  ];
  for (const f of FALLBACK_FIELDS) {
    if (latest[f] === null) {
      for (let i = historyAsc.length - 2; i >= 0; i--) {
        const v = historyAsc[i][f];
        if (v !== null && v !== undefined) {
          (latest as Record<string, unknown>)[f] = v;
          break;
        }
      }
    }
  }
  return latest;
}

// Supabase JS の暗黙1000行制限を回避するためページネーションする。
async function fetchAllPaginated<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}

// 大量のIDを .in() に渡すと URLが16KB を超えてエラーになるため、チャンク分割で取得する。
async function fetchMetricsByCompanyIds(ids: string[]): Promise<DbMetric[]> {
  if (ids.length === 0) return [];
  const sb = client();
  const CHUNK = 100; // 100社×5年 = 最大500行/req（Supabase 1000行制限内）
  const out: DbMetric[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("financial_metrics")
      .select(METRIC_SELECT)
      .in("company_id", chunk)
      .order("id");
    if (error) throw error;
    out.push(...((data ?? []) as DbMetric[]));
  }
  return out;
}

export const getAllCompanies = cache(async (): Promise<CompanyWithLatestMetrics[]> => {
  const sb = client();
  const companies = await fetchAllPaginated<DbCompany>((from, to) =>
    sb
      .from("companies")
      .select(COMPANY_SELECT)
      .order("name")
      .range(from, to) as unknown as PromiseLike<{
      data: DbCompany[] | null;
      error: { message: string } | null;
    }>
  );
  const metrics = await fetchMetricsByCompanyIds(companies.map((c) => c.id));
  return combine(companies, metrics);
});

// サイトマップ用：edinet_code と最終更新日時だけを軽量に全件取得する。
export const getCompanyIndexForSitemap = cache(
  async (): Promise<
    Array<{ edinetCode: string; lastModified: Date | null }>
  > => {
    const sb = client();
    type Row = { edinet_code: string; latest_submitted_at: string | null };
    const rows = await fetchAllPaginated<Row>((from, to) =>
      sb
        .from("companies")
        .select("edinet_code, latest_submitted_at")
        .order("edinet_code")
        .range(from, to) as unknown as PromiseLike<{
        data: Row[] | null;
        error: { message: string } | null;
      }>
    );
    return rows.map((r) => ({
      edinetCode: r.edinet_code,
      lastModified: r.latest_submitted_at
        ? new Date(r.latest_submitted_at)
        : null,
    }));
  }
);

export const getCompanyByEdinetCode = cache(
  async (edinetCode: string): Promise<CompanyWithLatestMetrics | null> => {
    const sb = client();
    const { data: company, error } = await sb
      .from("companies")
      .select(COMPANY_SELECT)
      .eq("edinet_code", edinetCode)
      .maybeSingle();
    if (error) throw error;
    if (!company) return null;
    const c = company as unknown as DbCompany;
    const { data: metrics, error: mErr } = await sb
      .from("financial_metrics")
      .select(METRIC_SELECT)
      .eq("company_id", c.id)
      .order("fiscal_year");
    if (mErr) throw mErr;
    const history = (metrics ?? []).map((m) => mapMetric(m as DbMetric));
    if (history.length === 0) return { ...mapCompany(c), latest: emptyMetric(c.id), history: [] };
    return {
      ...mapCompany(c),
      latest: computeLatestWithFallback(history),
      history,
    };
  }
);

function emptyMetric(companyId: string): FinancialMetric {
  return {
    companyId,
    fiscalYear: new Date().getFullYear(),
    averageAnnualSalary: null,
    averageAge: null,
    averageTenureYears: null,
    employeeCount: null,
    femaleManagerRatio: null,
    averageOvertimeHours: null,
    revenue: null,
    operatingIncome: null,
    ordinaryIncome: null,
    netIncome: null,
    docId: null,
    submittedAt: null,
  };
}

export type SortKey = "salary" | "tenure" | "employees" | "revenue" | "recent";

const SORT_COLUMNS: Record<SortKey, string> = {
  salary: "latest_avg_salary",
  tenure: "latest_tenure_years",
  employees: "latest_employee_count",
  revenue: "latest_revenue",
  recent: "latest_submitted_at",
};

export type SearchPageParams = {
  query?: string;
  /** 業界コードの配列。空 or 未指定なら全業界 */
  industryCodes?: string[];
  sort?: SortKey;
  page?: number;
  pageSize?: number;
  // 平均年収レンジ（円）。null は無制限。
  salaryMinYen?: number | null;
  salaryMaxYen?: number | null;
};

export type SearchPageResult = {
  items: CompanyWithLatestMetrics[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// サーバー側で並び替え+ページネーションして検索結果を返す高速版。
export async function searchCompaniesPaged(
  params: SearchPageParams
): Promise<SearchPageResult> {
  const sb = client();
  const sort: SortKey = params.sort ?? "salary";
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 30;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = sb
    .from("companies")
    .select(COMPANY_SELECT, { count: "exact" })
    .order(SORT_COLUMNS[sort], { ascending: false, nullsFirst: false })
    .range(from, to);

  if (params.industryCodes && params.industryCodes.length > 0) {
    q = q.in("industry_code", params.industryCodes);
  }
  if (params.salaryMinYen != null) {
    q = q.gte("latest_avg_salary", params.salaryMinYen);
  }
  if (params.salaryMaxYen != null) {
    q = q.lte("latest_avg_salary", params.salaryMaxYen);
  }
  if (params.query) {
    const safe = params.query.replace(/[%_]/g, "");
    const or = [
      `name.ilike.%${safe}%`,
      `name_kana.ilike.%${safe}%`,
      // コード類は前方一致（"7777" が EDINET "E37777" 等にマッチするノイズを防ぐ）
      `securities_code.ilike.${safe}%`,
      `edinet_code.ilike.${safe}%`,
    ].join(",");
    q = q.or(or);
  }

  const { data: companies, error: cErr, count } = await q;
  if (cErr) throw cErr;
  const dbCompanies = (companies ?? []) as unknown as DbCompany[];
  if (dbCompanies.length === 0) {
    return { items: [], total: count ?? 0, page, pageSize, totalPages: 0 };
  }

  const metrics = await fetchMetricsByCompanyIds(dbCompanies.map((c) => c.id));

  return {
    items: combine(dbCompanies, metrics),
    total: count ?? 0,
    page,
    pageSize,
    totalPages: count ? Math.ceil(count / pageSize) : 0,
  };
}

// 直近に有報を提出した N 社を取得（submitted_at 最新順）。
export async function getRecentCompanies(
  limit: number
): Promise<CompanyWithLatestMetrics[]> {
  const sb = client();
  // 最新提出日順に financial_metrics を見て、unique company_id を集める
  const { data: recent, error: rErr } = await sb
    .from("financial_metrics")
    .select("company_id, submitted_at")
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(limit * 6);
  if (rErr) throw rErr;

  const seen = new Set<string>();
  const ids: string[] = [];
  for (const r of recent ?? []) {
    if (!seen.has(r.company_id)) {
      seen.add(r.company_id);
      ids.push(r.company_id);
      if (ids.length >= limit) break;
    }
  }
  if (ids.length === 0) return [];

  const { data: companiesData, error: cErr } = await sb
    .from("companies")
    .select(COMPANY_SELECT)
    .in("id", ids);
  if (cErr) throw cErr;
  const companies = (companiesData ?? []) as unknown as DbCompany[];
  const metrics = await fetchMetricsByCompanyIds(ids);

  // ids の順序を保つ
  const byId = new Map(companies.map((c) => [c.id, c]));
  const ordered = ids.map((id) => byId.get(id)).filter((c): c is DbCompany => Boolean(c));
  return combine(ordered, metrics);
}

// サーバー側で名前・コード・カナで部分一致検索する。1000行制限を超える企業数でも安全。
export async function searchCompanies(
  query: string
): Promise<CompanyWithLatestMetrics[]> {
  if (!query) return getAllCompanies();
  const sb = client();
  const q = query.replace(/[%_]/g, ""); // PostgREST ilike のメタ文字を無効化
  // .or() に渡す文字列内のカンマやカッコは文法に影響するためエスケープが必要だが、
  // ここでは英数字+日本語の単純な部分一致を想定して素直に書く
  const orFilter = [
    `name.ilike.%${q}%`,
    `name_kana.ilike.%${q}%`,
    // コード類は前方一致でノイズを排除
    `securities_code.ilike.${q}%`,
    `edinet_code.ilike.${q}%`,
  ].join(",");
  const companies = await fetchAllPaginated<DbCompany>((from, to) =>
    sb
      .from("companies")
      .select(COMPANY_SELECT)
      .or(orFilter)
      .order("name")
      .range(from, to) as unknown as PromiseLike<{
      data: DbCompany[] | null;
      error: { message: string } | null;
    }>
  );
  if (companies.length === 0) return [];
  const metrics = await fetchMetricsByCompanyIds(companies.map((c) => c.id));
  return combine(companies, metrics);
}

export async function getCompaniesByIndustry(
  industryCode: string,
  excludeId?: string,
  limit?: number
): Promise<CompanyWithLatestMetrics[]> {
  const sb = client();
  let q = sb
    .from("companies")
    .select(COMPANY_SELECT)
    .eq("industry_code", industryCode)
    .order("latest_avg_salary", { ascending: false, nullsFirst: false });
  if (excludeId) q = q.neq("id", excludeId);
  if (limit) q = q.limit(limit);

  const companies = limit
    ? (await q).data
    : await fetchAllPaginated<DbCompany>((from, to) =>
        q.range(from, to) as unknown as PromiseLike<{
          data: DbCompany[] | null;
          error: { message: string } | null;
        }>
      );
  if (!companies || companies.length === 0) return [];
  const dbCompanies = companies as unknown as DbCompany[];
  const metrics = await fetchMetricsByCompanyIds(dbCompanies.map((c) => c.id));
  return combine(dbCompanies, metrics);
}

// 業種内ランキングを 2 つの COUNT クエリで取得する（4000社相当の集合でもURL長制限に当たらない）。
export async function getCompanyRankInIndustry(
  companyId: string,
  industryCode: string,
  companyLatestSalary: number | null
): Promise<{ rank: number; total: number }> {
  const sb = client();
  const totalP = sb
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("industry_code", industryCode);
  const aboveP = sb
    .from("companies")
    .select("id", { count: "exact", head: true })
    .eq("industry_code", industryCode)
    .neq("id", companyId)
    .gt("latest_avg_salary", companyLatestSalary ?? 0);
  const [{ count: total }, { count: above }] = await Promise.all([totalP, aboveP]);
  // 自社平均年収が NULL の場合はランク外（=末尾）扱い
  const rank =
    companyLatestSalary === null ? (total ?? 1) : (above ?? 0) + 1;
  return { rank, total: total ?? 1 };
}

export const getAllIndustries = cache(async (): Promise<Industry[]> => {
  const sb = client();
  // 実データを持つ業種のみ返す（フロントの「業界から探す」に出す対象）
  const { data, error } = await sb
    .from("industries")
    .select("code, name, parent_code, companies!inner(id)")
    .order("code");
  if (error) throw error;
  // 重複排除（companies join で複数行になる可能性）
  const seen = new Set<string>();
  const out: Industry[] = [];
  for (const r of (data ?? []) as Array<{
    code: string;
    name: string;
    parent_code: string | null;
  }>) {
    if (seen.has(r.code)) continue;
    seen.add(r.code);
    out.push({ code: r.code, name: r.name, parentCode: r.parent_code });
  }
  return out;
});

export const getIndustryByCode = cache(
  async (code: string): Promise<Industry | null> => {
    const all = await getAllIndustries();
    return all.find((i) => i.code === code) ?? null;
  }
);
