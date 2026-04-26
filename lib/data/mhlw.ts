import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type MhlwCompanyData = {
  avgOvertimeHours: number | null;
  overtimeTargetScope: string | null;
  parentalLeaveMalePct: number | null;
  parentalLeaveFemalePct: number | null;
  paidLeaveUptakePct: number | null;
  femaleChiefRatio: number | null;
  femaleManagerRatio: number | null;
  femaleManagerCount: number | null;
  managerTotalCount: number | null;
  femaleOfficerRatio: number | null;
  femaleOfficerCount: number | null;
  officerTotalCount: number | null;
  payGapAllPct: number | null;
  payGapRegularPct: number | null;
  payGapNonregularPct: number | null;
  certKurumin: string | null;
  certKuruminPlus: string | null;
  certTryKurumin: string | null;
  certPlatinumKurumin: string | null;
  certEruboshi: string | null;
  certPlatinumEruboshi: string | null;
  certYouthYell: string | null;
  certNadeshiko: string | null;
  systemCareerChange: string | null;
  systemRehireMidcareer: string | null;
  systemTraining: string | null;
  systemCareerConsulting: string | null;
  systemFlextime: string | null;
  systemTelework: string | null;
  systemShortHours: string | null;
  systemFertilityLeave: string | null;
  systemPaidLeaveHourly: string | null;
  dataTargetPeriod: string | null;
  dataAggregationPoint: string | null;
  dataTargetScope: string | null;
  dataUpdatedAt: string | null;
};

function num(v: number | string | null): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

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

// 認定取得済みかどうか（"認定あり" / "認定段階N" / "受賞" を真とみなす）
export function isCertified(value: string | null): boolean {
  if (!value) return false;
  return /認定あり|認定段階|受賞|選定/.test(value) && !/^受賞なし$/.test(value);
}
