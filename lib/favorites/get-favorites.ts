import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { brandColorFor } from "@/lib/data/brand-color";
import type { CompanyWithLatestMetrics } from "@/types";
import type { SortKey } from "@/lib/data/companies";

/**
 * 現在のユーザーが指定企業をお気に入り登録しているか
 */
export const isFavoritedByCurrentUser = cache(
  async (companyId: string): Promise<boolean> => {
    const user = await getCurrentUser();
    if (!user) return false;
    const sb = await createSupabaseServerClient();
    const { data } = await sb
      .from("user_favorites")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .maybeSingle();
    return !!data;
  }
);

export type FavoriteSort = "added" | "salary" | "tenure" | "employees" | "revenue";

const SORT_TO_KEY: Record<Exclude<FavoriteSort, "added">, string> = {
  salary: "latest_avg_salary",
  tenure: "latest_tenure_years",
  employees: "latest_employee_count",
  revenue: "latest_revenue",
};

const COMPANY_FIELDS =
  "id, edinet_code, securities_code, name, name_kana, industry_code, listed_market, description, summary, summary_generated_at, summary_source_doc_id, website_url, headquarters, founded_year, founded_at, representative, corporate_number, capital_stock_yen, fiscal_year_end_month, logo_url, cover_image_url, latest_fiscal_year, latest_avg_salary, latest_tenure_years, latest_employee_count, latest_revenue, latest_submitted_at, industries(code, name)";

type FavRow = {
  created_at: string;
  companies: Record<string, unknown> | null;
};

export type FavoriteItem = {
  addedAt: string;
  company: CompanyWithLatestMetrics;
};

/**
 * 現在のユーザーのお気に入り企業を取得（業界フィルタ + 並び順）。
 */
export const getMyFavorites = cache(
  async (opts: {
    industryCode?: string | null;
    sort?: FavoriteSort;
  } = {}): Promise<FavoriteItem[]> => {
    const user = await getCurrentUser();
    if (!user) return [];
    const sb = await createSupabaseServerClient();
    const sort = opts.sort ?? "added";

    // インラインで companies を埋め込み select。並び順は client 側で行う（join 越しの order に制限があるため）
    const { data, error } = await sb
      .from("user_favorites")
      .select(`created_at, companies!inner(${COMPANY_FIELDS})`)
      .eq("user_id", user.id);
    if (error || !data) return [];

    type Row = {
      created_at: string;
      companies: {
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
        latest_fiscal_year: number | null;
        latest_avg_salary: number | null;
        latest_tenure_years: number | string | null;
        latest_employee_count: number | null;
        latest_revenue: number | null;
        latest_submitted_at: string | null;
        industries: { code: string; name: string } | null;
      };
    };
    const rows = data as unknown as Row[];

    const filtered = opts.industryCode
      ? rows.filter((r) => r.companies.industry_code === opts.industryCode)
      : rows;

    const items: FavoriteItem[] = filtered.map((r) => {
      const c = r.companies;
      const industryName = c.industries?.name ?? null;
      const market = c.listed_market;
      const listedMarket =
        market === "プライム" || market === "スタンダード" || market === "グロース"
          ? market
          : null;
      const cap =
        c.capital_stock_yen === null || c.capital_stock_yen === undefined
          ? null
          : typeof c.capital_stock_yen === "number"
            ? c.capital_stock_yen
            : Number(c.capital_stock_yen);
      const tenure =
        c.latest_tenure_years === null
          ? null
          : typeof c.latest_tenure_years === "number"
            ? c.latest_tenure_years
            : Number(c.latest_tenure_years);
      return {
        addedAt: r.created_at,
        company: {
          id: c.id,
          edinetCode: c.edinet_code,
          securitiesCode: c.securities_code,
          name: c.name,
          nameKana: c.name_kana,
          industryCode: c.industry_code,
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
          capitalStockYen: cap !== null && Number.isFinite(cap) ? cap : null,
          fiscalYearEndMonth: c.fiscal_year_end_month,
          logoUrl: c.logo_url,
          brandColor: brandColorFor(c.industry_code),
          coverImageUrl: c.cover_image_url,
          latest: {
            companyId: c.id,
            fiscalYear: c.latest_fiscal_year ?? new Date().getFullYear(),
            averageAnnualSalary: c.latest_avg_salary,
            averageAge: null,
            averageTenureYears: tenure !== null && Number.isFinite(tenure) ? tenure : null,
            employeeCount: c.latest_employee_count,
            femaleManagerRatio: null,
            averageOvertimeHours: null,
            revenue: c.latest_revenue,
            operatingIncome: null,
            ordinaryIncome: null,
            netIncome: null,
            docId: null,
            submittedAt: c.latest_submitted_at,
          },
          history: [],
        },
      };
    });

    if (sort === "added") {
      items.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    } else {
      const key = SORT_TO_KEY[sort];
      items.sort((a, b) => {
        const av = readNumber(a.company.latest, key);
        const bv = readNumber(b.company.latest, key);
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return bv - av;
      });
    }
    return items;
  }
);

function readNumber(latest: CompanyWithLatestMetrics["latest"], key: string): number | null {
  switch (key) {
    case "latest_avg_salary":
      return latest.averageAnnualSalary;
    case "latest_tenure_years":
      return latest.averageTenureYears;
    case "latest_employee_count":
      return latest.employeeCount;
    case "latest_revenue":
      return latest.revenue;
    default:
      return null;
  }
}

/**
 * お気に入り企業を業界別にカウント（タブの (N) 表示用）
 */
export async function getFavoriteIndustryCounts(): Promise<
  Map<string, number>
> {
  const items = await getMyFavorites();
  const map = new Map<string, number>();
  for (const it of items) {
    const code = it.company.industryCode;
    if (!code) continue;
    map.set(code, (map.get(code) ?? 0) + 1);
  }
  return map;
}

// SortKey も外で使えるよう re-export
export type { SortKey };
