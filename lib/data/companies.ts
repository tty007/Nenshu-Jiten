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
  "id, edinet_code, securities_code, name, name_kana, industry_code, listed_market, description, summary, summary_generated_at, summary_source_doc_id, website_url, headquarters, founded_year, logo_url, cover_image_url, industries(code, name)";

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
    out.push({ ...mapCompany(c), latest: history[history.length - 1], history });
  }
  return out;
}

export const getAllCompanies = cache(async (): Promise<CompanyWithLatestMetrics[]> => {
  const sb = client();
  const [{ data: companies, error: cErr }, { data: metrics, error: mErr }] =
    await Promise.all([
      sb.from("companies").select(COMPANY_SELECT).order("name"),
      sb.from("financial_metrics").select(METRIC_SELECT),
    ]);
  if (cErr) throw cErr;
  if (mErr) throw mErr;
  return combine((companies ?? []) as unknown as DbCompany[], (metrics ?? []) as DbMetric[]);
});

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
    return { ...mapCompany(c), latest: history[history.length - 1], history };
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

export async function searchCompanies(
  query: string
): Promise<CompanyWithLatestMetrics[]> {
  const all = await getAllCompanies();
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.nameKana?.toLowerCase().includes(q) ?? false) ||
      (c.securitiesCode?.includes(q) ?? false) ||
      c.edinetCode.toLowerCase().includes(q) ||
      (c.industryName?.toLowerCase().includes(q) ?? false)
  );
}

export async function getCompaniesByIndustry(
  industryCode: string,
  excludeId?: string
): Promise<CompanyWithLatestMetrics[]> {
  const all = await getAllCompanies();
  return all.filter((c) => c.industryCode === industryCode && c.id !== excludeId);
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
