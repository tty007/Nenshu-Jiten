import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// =====================================================================
// 型
// =====================================================================

export type SalaryCompanyData = {
  id: string;
  edinet_code: string;
  securities_code: string | null;
  corporate_number: string | null;
  name: string;
  name_kana: string | null;
  industry_code: string | null;
  industry_name: string | null;
  listed_market: string | null;
  description: string | null;
  summary: string | null;
  website_url: string | null;
  headquarters: string | null;
  founded_year: number | null;
  founded_at: string | null;
  representative: string | null;
  capital_stock_yen: number | null;
  fiscal_year_end_month: number | null;
};

export type SalaryFinancialMetric = {
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
  submitted_at: string | null;
};

export type SalaryIndustryAverage = {
  industry_code: string;
  fiscal_year: number;
  avg_annual_salary: number | null;
  avg_tenure_years: number | null;
  avg_employee_count: number | null;
  avg_female_manager_ratio: number | null;
  avg_overtime_hours: number | null;
  sample_size: number;
};

export type SalaryPeerCompany = {
  id: string;
  edinet_code: string;
  name: string;
  latest_avg_salary: number | null;
  latest_employee_count: number | null;
  latest_fiscal_year: number | null;
};

export type SalaryArticleContext = {
  article: {
    id: string;
    title: string;
  };
  company: SalaryCompanyData;
  /** 新しい年度から並ぶ */
  history: SalaryFinancialMetric[];
  industry_averages: SalaryIndustryAverage[]; // 同業界・全年度
  peers: SalaryPeerCompany[]; // 同業界の上位 N 社（自社含む）
};

// =====================================================================
// 履歴の前処理
// =====================================================================

/**
 * 平均年収データが入った行を「最新」として扱える形に history を整える。
 *
 *  - history[0].average_annual_salary に値がある → そのまま使える
 *  - history[0] は null だが history[1] にはある → 先頭を捨てて返す
 *    （表示上 1 年前の有報が「最新」扱いとなる）
 *  - 1 年前にもなければ空配列を返す（記事は生成不可）
 *
 * セクション生成器は history[0] を「最新」として参照しているので、
 * 本関数のトリミングを通すだけで「フォールバック有り」と「使える年度」が
 * 自動的に揃う。
 */
export type SalaryHistoryAvailability = {
  history: SalaryFinancialMetric[];
  available: boolean;
  used_fallback: boolean;
  fiscal_year_used: number | null;
};

export function findSalaryReadyHistory(
  history: SalaryFinancialMetric[]
): SalaryHistoryAvailability {
  if (history.length === 0) {
    return {
      history: [],
      available: false,
      used_fallback: false,
      fiscal_year_used: null,
    };
  }
  if (history[0].average_annual_salary != null) {
    return {
      history,
      available: true,
      used_fallback: false,
      fiscal_year_used: history[0].fiscal_year,
    };
  }
  if (history.length >= 2 && history[1].average_annual_salary != null) {
    return {
      history: history.slice(1),
      available: true,
      used_fallback: true,
      fiscal_year_used: history[1].fiscal_year,
    };
  }
  return {
    history: [],
    available: false,
    used_fallback: false,
    fiscal_year_used: null,
  };
}

// =====================================================================
// 取得
// =====================================================================

const PEER_LIMIT = 12;

export async function loadSalaryArticleContext(
  articleId: string
): Promise<
  | { ok: true; data: SalaryArticleContext }
  | { ok: false; error: string }
> {
  const sb = createSupabaseAdminClient();

  // 記事
  const aRes = await sb
    .from("articles")
    .select("id, title")
    .eq("id", articleId)
    .maybeSingle();
  if (aRes.error || !aRes.data) {
    return { ok: false, error: "記事が見つかりません" };
  }

  // 紐付き企業（先頭 1 社のみ採用）
  const acRes = await sb
    .from("article_companies")
    .select("company_id, display_order")
    .eq("article_id", articleId)
    .order("display_order", { ascending: true })
    .limit(1);
  if (acRes.error || !acRes.data || acRes.data.length === 0) {
    return {
      ok: false,
      error:
        "この記事に企業が紐付いていません。先に「関連企業」を 1 社追加してください",
    };
  }
  const companyId = acRes.data[0].company_id as string;

  // 企業基本
  const cRes = await sb
    .from("companies")
    .select(
      `id, edinet_code, securities_code, corporate_number, name, name_kana,
       industry_code, listed_market, description, summary,
       website_url, headquarters, founded_year, founded_at,
       representative, capital_stock_yen, fiscal_year_end_month,
       industries(name)`
    )
    .eq("id", companyId)
    .maybeSingle();
  if (cRes.error || !cRes.data) {
    return { ok: false, error: "企業データが取得できません" };
  }
  const c: any = cRes.data;
  const indName = Array.isArray(c.industries)
    ? c.industries[0]?.name ?? null
    : c.industries?.name ?? null;

  const company: SalaryCompanyData = {
    id: c.id,
    edinet_code: c.edinet_code,
    securities_code: c.securities_code ?? null,
    corporate_number: c.corporate_number ?? null,
    name: c.name,
    name_kana: c.name_kana ?? null,
    industry_code: c.industry_code ?? null,
    industry_name: indName,
    listed_market: c.listed_market ?? null,
    description: c.description ?? null,
    summary: c.summary ?? null,
    website_url: c.website_url ?? null,
    headquarters: c.headquarters ?? null,
    founded_year: c.founded_year ?? null,
    founded_at: c.founded_at ?? null,
    representative: c.representative ?? null,
    capital_stock_yen: c.capital_stock_yen ?? null,
    fiscal_year_end_month: c.fiscal_year_end_month ?? null,
  };

  // 経年指標
  const fmRes = await sb
    .from("financial_metrics")
    .select(
      `fiscal_year, average_annual_salary, average_age, average_tenure_years,
       employee_count, female_manager_ratio, average_overtime_hours,
       revenue, operating_income, ordinary_income, net_income,
       doc_id, submitted_at`
    )
    .eq("company_id", companyId)
    .order("fiscal_year", { ascending: false });
  const history: SalaryFinancialMetric[] =
    fmRes.error || !fmRes.data
      ? []
      : fmRes.data.map((m: any) => ({
          fiscal_year: m.fiscal_year,
          average_annual_salary: m.average_annual_salary ?? null,
          average_age: m.average_age != null ? Number(m.average_age) : null,
          average_tenure_years:
            m.average_tenure_years != null
              ? Number(m.average_tenure_years)
              : null,
          employee_count: m.employee_count ?? null,
          female_manager_ratio:
            m.female_manager_ratio != null
              ? Number(m.female_manager_ratio)
              : null,
          average_overtime_hours:
            m.average_overtime_hours != null
              ? Number(m.average_overtime_hours)
              : null,
          revenue: m.revenue != null ? Number(m.revenue) : null,
          operating_income:
            m.operating_income != null ? Number(m.operating_income) : null,
          ordinary_income:
            m.ordinary_income != null ? Number(m.ordinary_income) : null,
          net_income: m.net_income != null ? Number(m.net_income) : null,
          doc_id: m.doc_id ?? null,
          submitted_at: m.submitted_at ?? null,
        }));

  // 業界平均
  let industry_averages: SalaryIndustryAverage[] = [];
  if (company.industry_code) {
    const iaRes = await sb
      .from("industry_averages")
      .select("*")
      .eq("industry_code", company.industry_code)
      .order("fiscal_year", { ascending: false });
    if (!iaRes.error && iaRes.data) {
      industry_averages = iaRes.data.map((a: any) => ({
        industry_code: a.industry_code,
        fiscal_year: a.fiscal_year,
        avg_annual_salary: a.avg_annual_salary ?? null,
        avg_tenure_years:
          a.avg_tenure_years != null ? Number(a.avg_tenure_years) : null,
        avg_employee_count: a.avg_employee_count ?? null,
        avg_female_manager_ratio:
          a.avg_female_manager_ratio != null
            ? Number(a.avg_female_manager_ratio)
            : null,
        avg_overtime_hours:
          a.avg_overtime_hours != null ? Number(a.avg_overtime_hours) : null,
        sample_size: a.sample_size ?? 0,
      }));
    }
  }

  // 同業界の上位企業（最新年度の平均年収順）
  const peers = await loadPeers(company.industry_code, company.id, PEER_LIMIT);

  // 平均年収データが入った行を最新として扱えるよう history をトリム。
  // 1 年前にもデータが無ければ history は空配列になり、呼び出し側で
  // 「生成不可」を判定できる。
  const trimmed = findSalaryReadyHistory(history);

  return {
    ok: true,
    data: {
      article: { id: aRes.data.id, title: aRes.data.title ?? "" },
      company,
      history: trimmed.history,
      industry_averages,
      peers,
    },
  };
}

async function loadPeers(
  industryCode: string | null,
  selfCompanyId: string,
  limit: number
): Promise<SalaryPeerCompany[]> {
  if (!industryCode) return [];
  const sb = createSupabaseAdminClient();

  const cRes = await sb
    .from("companies")
    .select("id, edinet_code, name")
    .eq("industry_code", industryCode);
  if (cRes.error || !cRes.data || cRes.data.length === 0) return [];

  const ids = cRes.data.map((c: any) => c.id as string);

  // 各社の最新年度のみ取得（軽量に limit を多めに）
  const fmRes = await sb
    .from("financial_metrics")
    .select(
      "company_id, fiscal_year, average_annual_salary, employee_count"
    )
    .in("company_id", ids)
    .order("fiscal_year", { ascending: false });
  if (fmRes.error || !fmRes.data) return [];

  // 各 company の最新年度を採用
  const latestByCompany = new Map<
    string,
    {
      fiscal_year: number;
      average_annual_salary: number | null;
      employee_count: number | null;
    }
  >();
  for (const m of fmRes.data) {
    const cid = m.company_id as string;
    if (latestByCompany.has(cid)) continue;
    latestByCompany.set(cid, {
      fiscal_year: m.fiscal_year as number,
      average_annual_salary: (m.average_annual_salary ?? null) as number | null,
      employee_count: (m.employee_count ?? null) as number | null,
    });
  }

  const rows: SalaryPeerCompany[] = cRes.data.map((c: any) => {
    const m = latestByCompany.get(c.id as string);
    return {
      id: c.id,
      edinet_code: c.edinet_code,
      name: c.name,
      latest_avg_salary: m?.average_annual_salary ?? null,
      latest_employee_count: m?.employee_count ?? null,
      latest_fiscal_year: m?.fiscal_year ?? null,
    };
  });

  // 平均年収降順、自社を含む上位 N 社
  rows.sort(
    (a, b) =>
      (b.latest_avg_salary ?? -1) - (a.latest_avg_salary ?? -1)
  );

  const top = rows.slice(0, limit);
  if (!top.some((r) => r.id === selfCompanyId)) {
    const self = rows.find((r) => r.id === selfCompanyId);
    if (self) {
      top.pop();
      top.push(self);
    }
  }
  return top;
}
