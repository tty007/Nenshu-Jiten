import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminCompanyDetail = {
  company: {
    id: string;
    edinet_code: string;
    securities_code: string | null;
    name: string;
    name_kana: string | null;
    industry_code: string | null;
    industry_name: string | null;
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
    capital_stock_yen: number | null;
    fiscal_year_end_month: number | null;
    created_at: string | null;
    updated_at: string | null;
  };
  metrics: {
    count: number;
    earliest_year: number | null;
    latest_year: number | null;
    latest: {
      fiscal_year: number;
      average_annual_salary: number | null;
      average_age: number | null;
      average_tenure_years: number | null;
      employee_count: number | null;
      female_manager_ratio: number | null;
      average_overtime_hours: number | null;
      revenue: number | null;
      operating_income: number | null;
      ordinary_income: number | null;
      net_income: number | null;
      doc_id: string | null;
    } | null;
  };
  raw_documents: {
    count: number;
    earliest_submitted_at: string | null;
    latest_submitted_at: string | null;
  };
  mhlw: {
    exists: boolean;
    imported_at: string | null;
    data_updated_at: string | null;
  };
  engagement: {
    favorites_count: number;
    page_views_total: number;
    page_views_last_30d: number;
  };
};

/**
 * 管理画面用：1 社の全データ集計を取得。
 * モーダル表示用。
 */
export async function getAdminCompanyDetail(
  companyId: string
): Promise<AdminCompanyDetail | null> {
  const sb = createSupabaseAdminClient();

  // 1. 企業基本情報 + 業界名
  const cRes = await sb
    .from("companies")
    .select(
      `id, edinet_code, securities_code, name, name_kana, industry_code,
       listed_market, description, summary, summary_generated_at,
       summary_source_doc_id, website_url, headquarters, founded_year,
       founded_at, representative, corporate_number, capital_stock_yen,
       fiscal_year_end_month, created_at, updated_at,
       industries(name)`
    )
    .eq("id", companyId)
    .maybeSingle();
  if (cRes.error || !cRes.data) return null;
  const c = cRes.data as any;
  const industryName = Array.isArray(c.industries)
    ? c.industries[0]?.name ?? null
    : c.industries?.name ?? null;

  // 2. financial_metrics の集計
  const fmRes = await sb
    .from("financial_metrics")
    .select(
      `fiscal_year, average_annual_salary, average_age, average_tenure_years,
       employee_count, female_manager_ratio, average_overtime_hours,
       revenue, operating_income, ordinary_income, net_income, doc_id`
    )
    .eq("company_id", companyId)
    .order("fiscal_year", { ascending: false });
  if (fmRes.error) throw fmRes.error;
  const fmRows = (fmRes.data ?? []) as any[];
  const earliestYear = fmRows.length
    ? Math.min(...fmRows.map((r) => r.fiscal_year as number))
    : null;
  const latestYear = fmRows.length
    ? Math.max(...fmRows.map((r) => r.fiscal_year as number))
    : null;
  const latest = fmRows[0] ?? null;

  // 3. raw_xbrl_documents の集計
  const rxRes = await sb
    .from("raw_xbrl_documents")
    .select("submitted_at")
    .eq("edinet_code", c.edinet_code)
    .order("submitted_at", { ascending: false });
  if (rxRes.error) throw rxRes.error;
  const rxRows = (rxRes.data ?? []) as Array<{ submitted_at: string | null }>;
  const earliestSubmitted = rxRows.length
    ? rxRows[rxRows.length - 1]?.submitted_at ?? null
    : null;
  const latestSubmitted = rxRows[0]?.submitted_at ?? null;

  // 4. mhlw_company_data の有無 + 取込日
  const mhlwRes = await sb
    .from("mhlw_company_data")
    .select("imported_at, data_updated_at")
    .eq("company_id", companyId)
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const mhlwExists = !mhlwRes.error && Boolean(mhlwRes.data);
  const mhlwImportedAt = (mhlwRes.data as any)?.imported_at ?? null;
  const mhlwDataUpdatedAt = (mhlwRes.data as any)?.data_updated_at ?? null;

  // 5. user_favorites のカウント
  const favRes = await sb
    .from("user_favorites")
    .select("user_id", { count: "exact", head: true })
    .eq("company_id", companyId);
  const favoritesCount = favRes.error ? 0 : favRes.count ?? 0;

  // 6. page_views: path '/t-{securities_code}' を sum(count) で per-company PV
  // securities_code が無い企業は PV 不明（0 表示）
  let pvTotal = 0;
  let pv30 = 0;
  if (c.securities_code) {
    const path = `/t-${c.securities_code}`;
    const pvAllRes = await sb
      .from("page_views")
      .select("count")
      .eq("path", path);
    if (!pvAllRes.error) {
      pvTotal = (pvAllRes.data ?? []).reduce(
        (s: number, r: any) => s + Number(r.count ?? 0),
        0
      );
    }
    const since30d = new Date(Date.now() - 30 * 86400_000)
      .toISOString()
      .slice(0, 10);
    const pv30Res = await sb
      .from("page_views")
      .select("count")
      .eq("path", path)
      .gte("date", since30d);
    if (!pv30Res.error) {
      pv30 = (pv30Res.data ?? []).reduce(
        (s: number, r: any) => s + Number(r.count ?? 0),
        0
      );
    }
  }

  return {
    company: {
      id: c.id,
      edinet_code: c.edinet_code,
      securities_code: c.securities_code ?? null,
      name: c.name,
      name_kana: c.name_kana ?? null,
      industry_code: c.industry_code ?? null,
      industry_name: industryName,
      listed_market: c.listed_market ?? null,
      description: c.description ?? null,
      summary: c.summary ?? null,
      summary_generated_at: c.summary_generated_at ?? null,
      summary_source_doc_id: c.summary_source_doc_id ?? null,
      website_url: c.website_url ?? null,
      headquarters: c.headquarters ?? null,
      founded_year: c.founded_year ?? null,
      founded_at: c.founded_at ?? null,
      representative: c.representative ?? null,
      corporate_number: c.corporate_number ?? null,
      capital_stock_yen:
        c.capital_stock_yen != null ? Number(c.capital_stock_yen) : null,
      fiscal_year_end_month: c.fiscal_year_end_month ?? null,
      created_at: c.created_at ?? null,
      updated_at: c.updated_at ?? null,
    },
    metrics: {
      count: fmRows.length,
      earliest_year: earliestYear,
      latest_year: latestYear,
      latest: latest
        ? {
            fiscal_year: latest.fiscal_year,
            average_annual_salary: latest.average_annual_salary ?? null,
            average_age: latest.average_age ?? null,
            average_tenure_years: latest.average_tenure_years ?? null,
            employee_count: latest.employee_count ?? null,
            female_manager_ratio: latest.female_manager_ratio ?? null,
            average_overtime_hours: latest.average_overtime_hours ?? null,
            revenue: latest.revenue != null ? Number(latest.revenue) : null,
            operating_income:
              latest.operating_income != null ? Number(latest.operating_income) : null,
            ordinary_income:
              latest.ordinary_income != null ? Number(latest.ordinary_income) : null,
            net_income: latest.net_income != null ? Number(latest.net_income) : null,
            doc_id: latest.doc_id ?? null,
          }
        : null,
    },
    raw_documents: {
      count: rxRows.length,
      earliest_submitted_at: earliestSubmitted,
      latest_submitted_at: latestSubmitted,
    },
    mhlw: {
      exists: mhlwExists,
      imported_at: mhlwImportedAt,
      data_updated_at: mhlwDataUpdatedAt,
    },
    engagement: {
      favorites_count: favoritesCount,
      page_views_total: pvTotal,
      page_views_last_30d: pv30,
    },
  };
}
