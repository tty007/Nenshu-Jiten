import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

// 型と純粋関数 (isCertified) は client component からも参照されるため
// server-only を含まない別ファイルに切り出している。互換のためここで再 export。
export { isCertified } from "./mhlw-types";
export type { MhlwCompanyData } from "./mhlw-types";
import type { MhlwCompanyData } from "./mhlw-types";

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

// データの存在だけ判定する軽量クエリ。会社単位で MHLW データが
// あるかどうかは公開情報なので、ゲート前でも呼んでよい。
export const hasMhlwForCompany = cache(
  async (companyId: string): Promise<boolean> => {
    const sb = client();
    const { count } = await sb
      .from("mhlw_company_data")
      .select("company_id", { head: true, count: "exact" })
      .eq("company_id", companyId);
    return (count ?? 0) > 0;
  }
);

export const getMhlwForCompany = cache(
  async (companyId: string): Promise<MhlwCompanyData | null> => {
    const sb = client();
    const { data, error } = await sb
      .from("mhlw_company_data")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      avgOvertimeHours: num(data.avg_overtime_hours),
      overtimeTargetScope: data.overtime_target_scope,
      parentalLeaveMalePct: num(data.parental_leave_male_pct),
      parentalLeaveFemalePct: num(data.parental_leave_female_pct),
      paidLeaveUptakePct: num(data.paid_leave_uptake_pct),
      femaleChiefRatio: num(data.female_chief_ratio),
      femaleManagerRatio: num(data.female_manager_ratio),
      femaleManagerCount: data.female_manager_count,
      managerTotalCount: data.manager_total_count,
      femaleOfficerRatio: num(data.female_officer_ratio),
      femaleOfficerCount: data.female_officer_count,
      officerTotalCount: data.officer_total_count,
      payGapAllPct: num(data.pay_gap_all_pct),
      payGapRegularPct: num(data.pay_gap_regular_pct),
      payGapNonregularPct: num(data.pay_gap_nonregular_pct),
      certKurumin: data.cert_kurumin,
      certKuruminPlus: data.cert_kurumin_plus,
      certTryKurumin: data.cert_try_kurumin,
      certPlatinumKurumin: data.cert_platinum_kurumin,
      certEruboshi: data.cert_eruboshi,
      certPlatinumEruboshi: data.cert_platinum_eruboshi,
      certYouthYell: data.cert_youth_yell,
      certNadeshiko: data.cert_nadeshiko,
      systemCareerChange: data.system_career_change,
      systemRehireMidcareer: data.system_rehire_midcareer,
      systemTraining: data.system_training,
      systemCareerConsulting: data.system_career_consulting,
      systemFlextime: data.system_flextime,
      systemTelework: data.system_telework,
      systemShortHours: data.system_short_hours,
      systemFertilityLeave: data.system_fertility_leave,
      systemPaidLeaveHourly: data.system_paid_leave_hourly,
      dataTargetPeriod: data.data_target_period,
      dataAggregationPoint: data.data_aggregation_point,
      dataTargetScope: data.data_target_scope,
      dataUpdatedAt: data.data_updated_at,
    };
  }
);

