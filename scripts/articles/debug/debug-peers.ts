import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

(async () => {
  // 1社サンプル: クミアイ化学（industry 3200）
  const { data: arts } = await sb.from("articles").select("id").eq("status", "draft").limit(500);
  const { data: ac } = await sb
    .from("article_companies")
    .select("article_id, company_id")
    .in("article_id", (arts ?? []).map((a: any) => a.id))
    .order("display_order", { ascending: true });
  // 「クミアイ化学」を探す
  const allCompanyIds = Array.from(new Set((ac ?? []).map((x: any) => x.company_id)));
  const { data: comps } = await sb.from("companies").select("id, name, industry_code").in("id", allCompanyIds);
  const kumiai = (comps ?? []).find((c: any) => c.name.includes("クミアイ化学")) as any;
  console.log("Sample company:", kumiai);

  // この company の financial_metrics 全行
  const { data: fms } = await sb
    .from("financial_metrics")
    .select("fiscal_year, average_annual_salary, employee_count")
    .eq("company_id", kumiai.id)
    .order("fiscal_year", { ascending: false });
  console.log(`financial_metrics for ${kumiai.name}:`);
  for (const m of fms ?? []) {
    console.log(`  fy=${(m as any).fiscal_year}  avg=${(m as any).average_annual_salary}  emp=${(m as any).employee_count}`);
  }

  // industry_code 3200 内で、average_annual_salary が non-null な financial_metrics の年度別件数
  const { data: indCompanies } = await sb.from("companies").select("id, name").eq("industry_code", "3200");
  console.log(`\nindustry 3200 has ${indCompanies?.length ?? 0} companies`);
  const indIds = (indCompanies ?? []).map((c: any) => c.id);
  const { data: indFms } = await sb
    .from("financial_metrics")
    .select("company_id, fiscal_year, average_annual_salary")
    .in("company_id", indIds);
  const byYear: Record<number, { total: number; withSal: number }> = {};
  for (const m of indFms ?? []) {
    const y = (m as any).fiscal_year as number;
    if (!byYear[y]) byYear[y] = { total: 0, withSal: 0 };
    byYear[y].total++;
    if ((m as any).average_annual_salary != null) byYear[y].withSal++;
  }
  console.log(`\nindustry 3200 financial_metrics by year:`);
  for (const y of Object.keys(byYear).map(Number).sort((a, b) => b - a)) {
    const r = byYear[y];
    console.log(`  fy=${y}  total=${r.total}  withSalary=${r.withSal}`);
  }

  // 自社の latest fiscal_year (loadPeers ロジック相当)
  const latestSalary = new Map<string, number | null>();
  const sorted = (indFms ?? []).slice().sort((a, b) => (b as any).fiscal_year - (a as any).fiscal_year);
  for (const m of sorted) {
    const cid = (m as any).company_id as string;
    if (latestSalary.has(cid)) continue;
    latestSalary.set(cid, ((m as any).average_annual_salary ?? null) as number | null);
  }
  let withSal = 0, total = 0;
  for (const [, v] of latestSalary) { total++; if (v != null) withSal++; }
  console.log(`\nlatest-only across industry 3200: total=${total} withSalary=${withSal}`);
})();
