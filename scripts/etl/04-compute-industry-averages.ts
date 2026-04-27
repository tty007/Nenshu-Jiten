/**
 * 04: financial_metrics を集計し industry_averages を更新する。
 */
import { supabaseAdmin } from "./lib/supabase";

async function main() {
  // 既存平均を消してから再集計
  const { error: delErr } = await supabaseAdmin
    .from("industry_averages")
    .delete()
    .neq("industry_code", "");
  if (delErr) throw delErr;

  // JSで集計。Supabase JS の暗黙1000行制限を回避するためページネーションする。
  const PAGE = 1000;
  const rows: Array<{
    fiscal_year: number;
    average_annual_salary: number | null;
    average_tenure_years: number | string | null;
    employee_count: number | null;
    female_manager_ratio: number | string | null;
    average_overtime_hours: number | string | null;
    companies: { industry_code: string | null } | { industry_code: string | null }[] | null;
  }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error: selErr } = await supabaseAdmin
      .from("financial_metrics")
      .select(
        "fiscal_year, average_annual_salary, average_tenure_years, employee_count, female_manager_ratio, average_overtime_hours, companies(industry_code)"
      )
      .order("id")
      .range(from, from + PAGE - 1);
    if (selErr) throw selErr;
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as typeof rows));
    if (data.length < PAGE) break;
  }
  console.log(`fetched ${rows.length} financial_metrics rows`);

  type Bucket = {
    salaries: number[];
    tenures: number[];
    employees: number[];
    female: number[];
    overtime: number[];
  };
  const buckets = new Map<string, Bucket>();
  for (const r of rows ?? []) {
    const companies = r.companies as
      | { industry_code: string | null }
      | { industry_code: string | null }[]
      | null;
    const company = Array.isArray(companies) ? companies[0] : companies;
    const ic = company?.industry_code;
    if (!ic) continue;
    const key = `${ic}|${r.fiscal_year}`;
    let b = buckets.get(key);
    if (!b) {
      b = { salaries: [], tenures: [], employees: [], female: [], overtime: [] };
      buckets.set(key, b);
    }
    if (r.average_annual_salary != null) b.salaries.push(r.average_annual_salary);
    if (r.average_tenure_years != null) b.tenures.push(Number(r.average_tenure_years));
    if (r.employee_count != null) b.employees.push(r.employee_count);
    if (r.female_manager_ratio != null) b.female.push(Number(r.female_manager_ratio));
    if (r.average_overtime_hours != null) b.overtime.push(Number(r.average_overtime_hours));
  }

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  const records: {
    industry_code: string;
    fiscal_year: number;
    avg_annual_salary: number | null;
    avg_tenure_years: number | null;
    avg_employee_count: number | null;
    avg_female_manager_ratio: number | null;
    avg_overtime_hours: number | null;
    sample_size: number;
  }[] = [];

  for (const [key, b] of buckets) {
    const [ic, fyStr] = key.split("|");
    const sampleSize = Math.max(b.salaries.length, b.tenures.length, b.employees.length);
    const salary = avg(b.salaries);
    const tenure = avg(b.tenures);
    const employees = avg(b.employees);
    const female = avg(b.female);
    const overtime = avg(b.overtime);
    records.push({
      industry_code: ic,
      fiscal_year: Number(fyStr),
      avg_annual_salary: salary !== null ? Math.round(salary) : null,
      avg_tenure_years: tenure !== null ? Math.round(tenure * 10) / 10 : null,
      avg_employee_count: employees !== null ? Math.round(employees) : null,
      avg_female_manager_ratio: female !== null ? Math.round(female * 10) / 10 : null,
      avg_overtime_hours: overtime !== null ? Math.round(overtime * 10) / 10 : null,
      sample_size: sampleSize,
    });
  }

  console.log(`computed ${records.length} (industry, fiscal_year) buckets`);
  const { error: insErr } = await supabaseAdmin.from("industry_averages").insert(records);
  if (insErr) throw insErr;
  console.log("inserted into industry_averages");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
