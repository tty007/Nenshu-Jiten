import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import type { IndustryAverage } from "@/types";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

function num(v: number | string | null): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const getAll = cache(async (): Promise<IndustryAverage[]> => {
  const sb = client();
  const { data, error } = await sb
    .from("industry_averages")
    .select(
      "industry_code, fiscal_year, avg_annual_salary, avg_tenure_years, avg_employee_count, avg_female_manager_ratio, avg_overtime_hours, sample_size"
    );
  if (error) throw error;
  return (data ?? []).map((r) => ({
    industryCode: r.industry_code,
    fiscalYear: r.fiscal_year,
    avgAnnualSalary: r.avg_annual_salary ?? 0,
    avgTenureYears: num(r.avg_tenure_years) ?? 0,
    avgEmployeeCount: r.avg_employee_count ?? 0,
    avgFemaleManagerRatio: num(r.avg_female_manager_ratio),
    avgOvertimeHours: num(r.avg_overtime_hours),
    sampleSize: r.sample_size,
  }));
});

export async function getIndustryAverage(
  industryCode: string | null,
  fiscalYear: number
): Promise<IndustryAverage | undefined> {
  if (!industryCode) return undefined;
  const all = await getAll();
  return all.find((a) => a.industryCode === industryCode && a.fiscalYear === fiscalYear);
}

export async function getIndustryAverageHistory(
  industryCode: string | null
): Promise<IndustryAverage[]> {
  if (!industryCode) return [];
  const all = await getAll();
  return all
    .filter((a) => a.industryCode === industryCode)
    .sort((a, b) => a.fiscalYear - b.fiscalYear);
}
