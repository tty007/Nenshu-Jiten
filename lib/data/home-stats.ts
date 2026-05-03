import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type HomeStats = {
  companyCount: number;
  industryCount: number;
  metricsCount: number;
  latestUpdate: string | null;
};

export type SalaryBucket = {
  key: string;
  label: string;
  min: number; // inclusive (yen)
  max: number | null; // exclusive (yen); null = no upper bound
  count: number;
};

export type SalaryDistribution = {
  buckets: SalaryBucket[];
  averageYen: number | null;
};

const SALARY_BUCKET_DEFS: Omit<SalaryBucket, "count">[] = [
  { key: "lt300", label: "300万円未満", min: 0, max: 3_000_000 },
  { key: "300_400", label: "300〜400万円", min: 3_000_000, max: 4_000_000 },
  { key: "400_500", label: "400〜500万円", min: 4_000_000, max: 5_000_000 },
  { key: "500_600", label: "500〜600万円", min: 5_000_000, max: 6_000_000 },
  { key: "600_700", label: "600〜700万円", min: 6_000_000, max: 7_000_000 },
  { key: "700_800", label: "700〜800万円", min: 7_000_000, max: 8_000_000 },
  { key: "800_900", label: "800〜900万円", min: 8_000_000, max: 9_000_000 },
  { key: "900_1000", label: "900〜1000万円", min: 9_000_000, max: 10_000_000 },
  { key: "ge1000", label: "1000万円以上", min: 10_000_000, max: null },
];

export const getHomeStats = cache(async (): Promise<HomeStats> => {
  const sb = client();
  const [companyRes, industryRes, metricsRes, latestRes] = await Promise.all([
    sb.from("companies").select("id", { head: true, count: "exact" }),
    sb.from("industries").select("code", { head: true, count: "exact" }),
    sb.from("financial_metrics").select("id", { head: true, count: "exact" }),
    sb
      .from("companies")
      .select("latest_submitted_at")
      .not("latest_submitted_at", "is", null)
      .order("latest_submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    companyCount: companyRes.count ?? 0,
    industryCount: industryRes.count ?? 0,
    metricsCount: metricsRes.count ?? 0,
    latestUpdate:
      (latestRes.data as { latest_submitted_at?: string } | null)
        ?.latest_submitted_at ?? null,
  };
});

export const getIndustryCompanyCounts = cache(
  async (): Promise<Record<string, number>> => {
    const sb = client();
    const counts: Record<string, number> = {};
    const pageSize = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await sb
        .from("companies")
        .select("industry_code")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = (data ?? []) as { industry_code: string | null }[];
      for (const r of rows) {
        if (!r.industry_code) continue;
        counts[r.industry_code] = (counts[r.industry_code] ?? 0) + 1;
      }
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    return counts;
  }
);

export const getSalaryDistribution = cache(
  async (): Promise<SalaryDistribution> => {
    const sb = client();
    const counts = await Promise.all(
      SALARY_BUCKET_DEFS.map(async (b) => {
        let q = sb
          .from("companies")
          .select("id", { head: true, count: "exact" })
          .gte("latest_avg_salary", b.min);
        if (b.max !== null) q = q.lt("latest_avg_salary", b.max);
        const { count } = await q;
        return count ?? 0;
      })
    );
    const buckets = SALARY_BUCKET_DEFS.map((b, i) => ({
      ...b,
      count: counts[i],
    }));
    // 加重平均：bucket 中央値ベースで概算（個別行を引かないので軽量）
    const total = buckets.reduce((s, b) => s + b.count, 0);
    const sum = buckets.reduce((s, b) => {
      const mid = b.max === null ? 12_500_000 : (b.min + b.max) / 2;
      return s + mid * b.count;
    }, 0);
    return {
      buckets,
      averageYen: total > 0 ? Math.round(sum / total) : null,
    };
  }
);
