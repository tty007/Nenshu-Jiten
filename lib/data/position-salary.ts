// 令和7年度 賃金構造基本統計調査・役職別賃金（男女計）。
// 出典: 厚生労働省 / lib/company-db/令和7年度役職別賃金.csv

type Role = "部長級" | "課長級" | "係長級" | "非役職者";

type NationalRow = {
  role: Role;
  ageYears: number;
  monthlySalaryJpy: number; // 円
  ratioVsNonPosition: number; // 非役職者を100とした賃金比
};

const NATIONAL: NationalRow[] = [
  { role: "部長級", ageYears: 53.1, monthlySalaryJpy: 635_800, ratioVsNonPosition: 2.048 },
  { role: "課長級", ageYears: 49.5, monthlySalaryJpy: 529_200, ratioVsNonPosition: 1.704 },
  { role: "係長級", ageYears: 45.4, monthlySalaryJpy: 399_200, ratioVsNonPosition: 1.286 },
  { role: "非役職者", ageYears: 41.8, monthlySalaryJpy: 310_500, ratioVsNonPosition: 1.000 },
];

// 国の役職構成比（一般労働者・男女計の概数）。
// 賃金構造基本統計調査ベースの公表値から取得。
const NATIONAL_COMPOSITION: Record<Role, number> = {
  部長級: 0.04,
  課長級: 0.08,
  係長級: 0.10,
  非役職者: 0.78,
};

// 国の加重平均が「非役職者の何倍か」。
// 例: 0.04*2.048 + 0.08*1.704 + 0.10*1.286 + 0.78*1.0 ≈ 1.127
const NATIONAL_OVERALL_VS_NONPOSITION = NATIONAL.reduce(
  (sum, n) => sum + n.ratioVsNonPosition * NATIONAL_COMPOSITION[n.role],
  0
);

// HTML に常時露出して良い情報（役職ラベル＋国の平均年齢のみ）。
// 会社固有の年収は含まない。
export type NationalRolePublic = { role: Role; nationalAge: number };
export const NATIONAL_ROLES_PUBLIC: NationalRolePublic[] = NATIONAL.map(
  (n) => ({ role: n.role, nationalAge: n.ageYears })
);

export type PositionSalaryEstimate = {
  role: Role;
  nationalAge: number;
  estimatedAnnualSalary: number;
  vsCompanyAveragePct: number; // 会社平均との差(%) — +なら平均より上、-なら下
};

export type PositionSalaryEstimateResult = {
  companyAvgAge: number;
  companyAvgAnnualSalary: number;
  nonPositionEstimate: number;
  overallVsNonPositionRatio: number; // = NATIONAL_OVERALL_VS_NONPOSITION
  composition: Record<Role, number>;
  estimates: PositionSalaryEstimate[];
};

export function estimatePositionSalaries(
  companyAvgAge: number | null,
  companyAvgAnnualSalary: number | null
): PositionSalaryEstimateResult | null {
  if (
    companyAvgAge === null ||
    companyAvgAnnualSalary === null ||
    companyAvgAge <= 0 ||
    companyAvgAnnualSalary <= 0
  ) {
    return null;
  }

  // 国構成と同じ役職構成・賞与水準と仮定し、会社の非役職者推定年収を逆算。
  const nonPositionEstimate =
    companyAvgAnnualSalary / NATIONAL_OVERALL_VS_NONPOSITION;

  const estimates: PositionSalaryEstimate[] = NATIONAL.map((n) => {
    const annual =
      Math.round((nonPositionEstimate * n.ratioVsNonPosition) / 1000) * 1000;
    return {
      role: n.role,
      nationalAge: n.ageYears,
      estimatedAnnualSalary: annual,
      vsCompanyAveragePct:
        ((annual - companyAvgAnnualSalary) / companyAvgAnnualSalary) * 100,
    };
  });

  return {
    companyAvgAge,
    companyAvgAnnualSalary,
    nonPositionEstimate: Math.round(nonPositionEstimate / 1000) * 1000,
    overallVsNonPositionRatio: NATIONAL_OVERALL_VS_NONPOSITION,
    composition: NATIONAL_COMPOSITION,
    estimates,
  };
}
