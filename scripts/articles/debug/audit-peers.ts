/**
 * 67件の draft を走査し、「同業他社との比較」セクションが
 * スカスカ表示 (peers.length === 0 or total_in_industry === 0) になっている
 * 記事を抽出して、原因内訳を集計する。
 *
 * 集計カテゴリ:
 *   A: company.industry_code が NULL
 *   B: 同 industry_code の会社が 1社しかない (= 自社のみ)
 *   C: 同業界の会社はいるが、平均年収を有報記載している会社が 0-1 社
 *   D: 正常 (2社以上の比較データあり)
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type Row = {
  article_id: string;
  title: string;
  company_id: string;
  company_name: string;
  industry_code: string | null;
  industry_total: number; // 同 industry_code の会社数
  industry_with_salary: number; // うち average_annual_salary を最新年度に持つ会社数
  self_has_salary: boolean;
  category: "A" | "B" | "C" | "D";
};

async function main() {
  // 1. draft の articles 取得
  const { data: arts, error: e1 } = await sb
    .from("articles")
    .select("id, title, body_html, updated_at")
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (e1) throw e1;
  const targets = (arts ?? []).filter((a: any) => (a.body_html ?? "").length > 1000);
  console.log(`Drafts: ${targets.length}`);

  // 2. article_companies で company_id を引く
  const ids = targets.map((a: any) => a.id);
  const { data: acs, error: e2 } = await sb
    .from("article_companies")
    .select("article_id, company_id, display_order")
    .in("article_id", ids)
    .order("display_order", { ascending: true });
  if (e2) throw e2;
  const firstCompanyByArticle = new Map<string, string>();
  for (const ac of acs ?? []) {
    if (!firstCompanyByArticle.has((ac as any).article_id)) {
      firstCompanyByArticle.set((ac as any).article_id, (ac as any).company_id);
    }
  }

  // 3. company 情報を一括取得
  const companyIds = Array.from(firstCompanyByArticle.values());
  const { data: companies } = await sb
    .from("companies")
    .select("id, name, industry_code")
    .in("id", companyIds);
  const companyById = new Map((companies ?? []).map((c: any) => [c.id, c]));

  // 4. industry_code ごとに会社数と financial_metrics を集計（バッチ化）
  const indCodes = Array.from(
    new Set((companies ?? []).map((c: any) => c.industry_code).filter(Boolean))
  ) as string[];
  // 各 industry の company id 一覧
  const { data: indCompanies } = await sb
    .from("companies")
    .select("id, industry_code")
    .in("industry_code", indCodes);
  const idsByIndustry = new Map<string, string[]>();
  for (const c of indCompanies ?? []) {
    const ic = (c as any).industry_code as string;
    if (!idsByIndustry.has(ic)) idsByIndustry.set(ic, []);
    idsByIndustry.get(ic)!.push((c as any).id);
  }

  // 5. financial_metrics 最新年度の average_annual_salary を一括取得
  // .in() に大量のIDを渡すと URL 長制限で silent fail するため、industry 単位で取得する
  const latestSalary = new Map<string, number | null>();
  for (const [_indCode, idsInInd] of idsByIndustry) {
    // 1リクエストあたり PostgREST のデフォルト 1000 行制限を超えうるため、ページネーション
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data: fms, error } = await sb
        .from("financial_metrics")
        .select("company_id, fiscal_year, average_annual_salary")
        .in("company_id", idsInInd)
        .order("fiscal_year", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      if (!fms || fms.length === 0) break;
      for (const m of fms) {
        const cid = (m as any).company_id as string;
        if (latestSalary.has(cid)) continue;
        latestSalary.set(cid, ((m as any).average_annual_salary ?? null) as number | null);
      }
      if (fms.length < pageSize) break;
      offset += pageSize;
    }
  }

  // 6. 各記事を分類
  const rows: Row[] = [];
  for (const a of targets) {
    const articleId = (a as any).id as string;
    const companyId = firstCompanyByArticle.get(articleId);
    if (!companyId) continue;
    const company = companyById.get(companyId);
    if (!company) continue;
    const indCode = (company as any).industry_code as string | null;
    const indIds = indCode ? idsByIndustry.get(indCode) ?? [] : [];
    const industryTotal = indIds.length;
    const industryWithSalary = indIds.filter(
      (id) => latestSalary.get(id) != null
    ).length;
    const selfSalary = latestSalary.get(companyId) ?? null;
    let category: Row["category"];
    if (!indCode) category = "A";
    else if (industryTotal <= 1) category = "B";
    else if (industryWithSalary <= 1) category = "C";
    else category = "D";
    rows.push({
      article_id: articleId,
      title: ((a as any).title as string) ?? "",
      company_id: companyId,
      company_name: (company as any).name as string,
      industry_code: indCode,
      industry_total: industryTotal,
      industry_with_salary: industryWithSalary,
      self_has_salary: selfSalary != null,
      category,
    });
  }

  // 7. レポート
  const byCat: Record<string, Row[]> = { A: [], B: [], C: [], D: [] };
  for (const r of rows) byCat[r.category].push(r);
  console.log(`\n=== カテゴリ別件数 ===`);
  console.log(`  A (industry_code NULL):           ${byCat.A.length}`);
  console.log(`  B (同業界に自社のみ):              ${byCat.B.length}`);
  console.log(`  C (有報平均年収開示 0-1 社):       ${byCat.C.length}`);
  console.log(`  D (正常 — 比較可能):              ${byCat.D.length}`);

  for (const cat of ["A", "B", "C"] as const) {
    if (byCat[cat].length === 0) continue;
    console.log(`\n--- カテゴリ ${cat} の記事一覧 ---`);
    for (const r of byCat[cat]) {
      console.log(
        `  ${r.company_name.padEnd(25, " ")}  ind=${r.industry_code ?? "NULL"}  total=${r.industry_total}  withSalary=${r.industry_with_salary}  selfSalary=${r.self_has_salary ? "Y" : "N"}  ${r.title.slice(0, 30)}`
      );
    }
  }
  console.log(`\n--- カテゴリ D 中、業界企業数 < 5 の薄い記事 ---`);
  for (const r of byCat.D.filter((x) => x.industry_with_salary < 5)) {
    console.log(
      `  ${r.company_name.padEnd(25, " ")}  ind=${r.industry_code}  withSalary=${r.industry_with_salary} / total=${r.industry_total}`
    );
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
