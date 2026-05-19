import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

(async () => {
  const industryCode = "9050";
  // 1. companies in industry
  const cRes = await sb.from("companies").select("id, edinet_code, name").eq("industry_code", industryCode);
  console.log("companies:", cRes.data?.length, "error:", cRes.error);
  if (!cRes.data) return;
  const ids = cRes.data.map((c: any) => c.id);

  // 2. financial_metrics in
  const fmRes = await sb
    .from("financial_metrics")
    .select("company_id, fiscal_year, average_annual_salary, employee_count")
    .in("company_id", ids)
    .order("fiscal_year", { ascending: false });
  console.log("financial_metrics rows returned:", fmRes.data?.length, "error:", fmRes.error);

  // 3. latest by company
  const latestByCompany = new Map<string, { fy: number; avg: number | null }>();
  for (const m of fmRes.data ?? []) {
    const cid = (m as any).company_id as string;
    if (latestByCompany.has(cid)) continue;
    latestByCompany.set(cid, {
      fy: (m as any).fiscal_year,
      avg: ((m as any).average_annual_salary ?? null) as number | null,
    });
  }
  console.log("unique companies in fm:", latestByCompany.size);
  let withSal = 0;
  for (const [, v] of latestByCompany) if (v.avg != null) withSal++;
  console.log("with salary in latest:", withSal);

  // 4. distribution of fiscal_year in the returned rows
  const fyDist: Record<number, number> = {};
  for (const m of fmRes.data ?? []) {
    const y = (m as any).fiscal_year as number;
    fyDist[y] = (fyDist[y] ?? 0) + 1;
  }
  console.log("\nfiscal_year distribution in returned rows:");
  for (const y of Object.keys(fyDist).map(Number).sort((a, b) => b - a)) {
    console.log(`  fy=${y}  rows=${fyDist[y]}`);
  }
})();
