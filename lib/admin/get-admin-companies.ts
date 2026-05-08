import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AdminCompanyRow = {
  id: string;
  edinet_code: string;
  securities_code: string | null;
  name: string;
  name_kana: string | null;
  industry_code: string | null;
  industry_name: string | null;
  listed_market: string | null;
  headquarters: string | null;
  founded_year: number | null;
  latest_fiscal_year: number | null;
  latest_average_annual_salary: number | null;
};

export type ListAdminCompaniesOptions = {
  search?: string;
  industryCode?: string;
  limit?: number;
  offset?: number;
};

export type ListAdminCompaniesResult = {
  rows: AdminCompanyRow[];
  total: number;
};

const PAGE_SIZE_DEFAULT = 50;

/**
 * 管理画面用の企業一覧取得（ページング・検索・業界フィルタ対応）。
 * 最新 fiscal_year と平均年収を 1 列だけ join して表示する。
 */
export async function listAdminCompanies(
  opts: ListAdminCompaniesOptions = {}
): Promise<ListAdminCompaniesResult> {
  const sb = createSupabaseAdminClient();
  const limit = Math.max(1, Math.min(opts.limit ?? PAGE_SIZE_DEFAULT, 200));
  const offset = Math.max(0, opts.offset ?? 0);

  let q = sb
    .from("companies")
    .select(
      `id, edinet_code, securities_code, name, name_kana,
       industry_code, listed_market, headquarters, founded_year,
       industries(name)`,
      { count: "exact" }
    )
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (opts.industryCode) q = q.eq("industry_code", opts.industryCode);
  if (opts.search) {
    // PostgREST の or() はカンマで区切る。検索文字にカンマを含めない前提
    const s = opts.search.replace(/[,]/g, " ").trim();
    if (s) {
      // ilike は % が必要、escape は省略（社名検索に %_ は通常出ない）
      const esc = s.replace(/[%_]/g, " ");
      q = q.or(
        `name.ilike.%${esc}%,name_kana.ilike.%${esc}%,edinet_code.ilike.%${esc}%,securities_code.ilike.%${esc}%`
      );
    }
  }

  const res = await q;
  if (res.error) throw res.error;
  const companies = res.data ?? [];
  const ids = companies.map((c: any) => c.id as string);

  // 最新 financial_metrics を 1 行だけ取得（年収カラムだけ表示用）
  const latestMap = new Map<
    string,
    { fiscal_year: number; average_annual_salary: number | null }
  >();
  if (ids.length > 0) {
    const fmRes = await sb
      .from("financial_metrics")
      .select("company_id, fiscal_year, average_annual_salary")
      .in("company_id", ids)
      .order("fiscal_year", { ascending: false });
    if (!fmRes.error) {
      for (const r of fmRes.data ?? []) {
        if (!latestMap.has(r.company_id as string)) {
          latestMap.set(r.company_id as string, {
            fiscal_year: r.fiscal_year as number,
            average_annual_salary: (r.average_annual_salary ?? null) as number | null,
          });
        }
      }
    }
  }

  const rows: AdminCompanyRow[] = companies.map((c: any) => {
    const ind = Array.isArray(c.industries) ? c.industries[0] : c.industries;
    const latest = latestMap.get(c.id as string);
    return {
      id: c.id,
      edinet_code: c.edinet_code,
      securities_code: c.securities_code ?? null,
      name: c.name,
      name_kana: c.name_kana ?? null,
      industry_code: c.industry_code ?? null,
      industry_name: ind?.name ?? null,
      listed_market: c.listed_market ?? null,
      headquarters: c.headquarters ?? null,
      founded_year: c.founded_year ?? null,
      latest_fiscal_year: latest?.fiscal_year ?? null,
      latest_average_annual_salary: latest?.average_annual_salary ?? null,
    };
  });

  return { rows, total: res.count ?? 0 };
}

/**
 * フィルタ用：業界一覧を取得（コード昇順）
 */
export async function listAdminIndustries(): Promise<
  Array<{ code: string; name: string }>
> {
  const sb = createSupabaseAdminClient();
  const res = await sb
    .from("industries")
    .select("code, name")
    .order("code", { ascending: true });
  if (res.error) throw res.error;
  return (res.data ?? []).map((r) => ({
    code: r.code as string,
    name: r.name as string,
  }));
}

