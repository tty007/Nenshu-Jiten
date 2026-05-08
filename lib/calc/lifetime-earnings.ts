// 生涯年収の推計
//
// アルゴリズム：
//
//   在職中合計 = Σ (年代別推定年収 × その年代の年数)
//                ≈ 22-24歳×3年 + 25-29×5 + 30-34×5 + 35-39×5 + 40-44×5 + 45-49×5 + 50-54×5 + 55-59×5
//                  （60歳定年想定で 60-64 / 65-69 は除外）
//
//   退職金 = company_avg_annual × RETIREMENT_FACTOR
//          (大企業 60歳定年・勤続38年の経験則として 2.5 倍を採用)
//
//   生涯年収 = 在職中合計 + 退職金
//
// この値は「学卒入社〜60歳定年まで同社一貫」の理想シナリオ。
// 実際は転職・休職・退職金規程の差異で大きく変動する旨を表示時に明示する。

import {
  estimateAgeSalary,
  type AgeSalaryResult,
} from "./age-salary";
import { AGE_CLASS_YEARS, type AgeClass } from "./wage-census";

const LIFETIME_AGE_CLASSES: AgeClass[] = [
  "20-24",
  "25-29",
  "30-34",
  "35-39",
  "40-44",
  "45-49",
  "50-54",
  "55-59",
];

const RETIREMENT_MULTIPLIER = 2.5; // 大企業 60歳定年・勤続38年の経験則

export type LifetimeEarningsBreakdown = {
  age_class: AgeClass;
  age_label: string;
  years: number;
  annual_yen: number;
  subtotal_yen: number;
};

export type LifetimeEarningsResult = {
  /** 在職中（22-60 歳の積算）*/
  working_total_yen: number;
  /** 退職金推計 */
  retirement_yen: number;
  /** 生涯年収（在職中 + 退職金）*/
  grand_total_yen: number;
  /** 内訳（年代別 × 年数）*/
  breakdown: LifetimeEarningsBreakdown[];
  notes: string[];
};

export function estimateLifetimeEarnings(args: {
  companyAvgAnnualYen: number | null | undefined;
  industryName: string | null | undefined;
}): LifetimeEarningsResult | null {
  const avg = args.companyAvgAnnualYen;
  if (avg == null || !Number.isFinite(avg) || avg <= 0) return null;

  const ageRes: AgeSalaryResult | null = estimateAgeSalary({
    companyAvgAnnualYen: avg,
    industryName: args.industryName,
  });
  if (!ageRes) return null;

  const breakdown: LifetimeEarningsBreakdown[] = [];
  let workingTotal = 0;

  for (const ac of LIFETIME_AGE_CLASSES) {
    const row = ageRes.rows.find((r) => r.age_class === ac);
    if (!row || row.estimated_annual_yen <= 0) continue;
    const years = AGE_CLASS_YEARS[ac];
    if (years <= 0) continue;
    const subtotal = row.estimated_annual_yen * years;
    workingTotal += subtotal;
    breakdown.push({
      age_class: ac,
      age_label: row.age_label,
      years,
      annual_yen: row.estimated_annual_yen,
      subtotal_yen: subtotal,
    });
  }

  const retirement = Math.round(avg * RETIREMENT_MULTIPLIER);
  const grand = workingTotal + retirement;

  return {
    working_total_yen: workingTotal,
    retirement_yen: retirement,
    grand_total_yen: grand,
    breakdown,
    notes: [
      "学卒入社（22 歳）〜 60 歳定年・勤続 38 年・同社一貫を想定した理想シナリオの試算です。",
      "退職金は「大企業 60 歳定年・勤続 38 年」の経験則として平均年収の 2.5 倍を採用しています。実際は退職金規程・自己都合 / 会社都合・確定拠出年金の有無で大きく変動します。",
      "転職・休職・育休等の中断、賃上げ / 賃下げの将来変動は含みません。",
    ],
  };
}
