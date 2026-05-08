// 役職別の推定年収
//
// アルゴリズム（加重平均ベース）：
//
//   weighted_avg = Σ (role_monthly × headcount_share[role])
//   ratio[role]  = role_monthly / weighted_avg
//   estimated_annual[role] = company_avg_annual × ratio[role]
//
// 「役職比率を加重平均した時に company_avg と一致する」よう内部整合する。
// 例：部長 5% / 課長 10% / 係長 15% / 非役職 70% の人員構成を仮定。

import {
  ROLE_LABEL,
  ROLE_ORDER,
  ROLE_WAGE,
  ROLE_HEADCOUNT_DEFAULT,
  getWeightedRoleWage,
  type RoleLevel,
} from "./wage-census";

export type RoleSalaryRow = {
  role: RoleLevel;
  label: string;
  /** 推定年収（円）*/
  estimated_annual_yen: number;
  /** 統計の月給（千円）*/
  census_monthly_kjpy: number;
  /** 想定の平均年齢（参考）*/
  avg_age: number;
  /** 想定の平均勤続（参考）*/
  tenure: number;
  /** 加重平均に対する倍率 */
  ratio: number;
  /** 想定人員構成比 */
  headcount_share: number;
};

export type RoleSalaryResult = {
  weighted_avg_monthly_kjpy: number;
  rows: RoleSalaryRow[];
  notes: string[];
};

export function estimateRoleSalary(args: {
  companyAvgAnnualYen: number | null | undefined;
  /** カスタムの人員構成比を渡したい場合（合計 1.0 になるように）*/
  headcountWeights?: Partial<Record<RoleLevel, number>>;
}): RoleSalaryResult | null {
  const avg = args.companyAvgAnnualYen;
  if (avg == null || !Number.isFinite(avg) || avg <= 0) return null;

  // ウェイトの合成（指定無しは default、指定あれば合計を 1.0 に正規化）
  const weights = { ...ROLE_HEADCOUNT_DEFAULT };
  if (args.headcountWeights) {
    for (const r of ROLE_ORDER) {
      const w = args.headcountWeights[r];
      if (w != null && Number.isFinite(w)) weights[r] = w;
    }
    const sum = ROLE_ORDER.reduce((s, r) => s + weights[r], 0);
    if (sum > 0) {
      for (const r of ROLE_ORDER) weights[r] = weights[r] / sum;
    }
  }

  const weighted = getWeightedRoleWage(weights);

  const rows: RoleSalaryRow[] = ROLE_ORDER.map((role) => {
    const ratio = ROLE_WAGE[role].monthly / weighted;
    return {
      role,
      label: ROLE_LABEL[role],
      estimated_annual_yen: Math.round(avg * ratio),
      census_monthly_kjpy: ROLE_WAGE[role].monthly,
      avg_age: ROLE_WAGE[role].avg_age,
      tenure: ROLE_WAGE[role].tenure,
      ratio,
      headcount_share: weights[role],
    };
  });

  return {
    weighted_avg_monthly_kjpy: weighted,
    rows,
    notes: [
      "厚生労働省「役職別賃金（令和7年度）」の月給比率を、想定する人員構成（部長 5% / 課長 10% / 係長 15% / 非役職 70%）で加重平均した値を 1.0 とし、各役職の倍率を企業の平均年収に乗算した推計値です。",
    ],
  };
}
