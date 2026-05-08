// 年代別の推定年収
//
// アルゴリズム（係数法）：
//
//   ratio[X] = census_monthly[X] / census_monthly[年齢計]
//   estimated_annual[X] = company_avg_annual × ratio[X]
//
// 賃金センサスの「同業界の年齢別 月給カーブ」を相対的なシェイプとして使い、
// それを企業の実際の平均年収（賞与込み）に乗算する。
// → 月給↔年収の単位換算が不要になる（ratio が unitless になる）
//
// 業界マッピングが存在しない場合は「全産業 年齢計」を分母にしたフォールバック。

import {
  AGE_CLASS_LABEL,
  AGE_CLASS_ORDER,
  CENSUS_ALL_INDUSTRIES_TOTAL,
  CENSUS_INDUSTRY_LABEL,
  CENSUS_WAGES,
  type AgeClass,
  type CensusIndustry,
} from "./wage-census";
import { mapIndustryNameToCensus } from "./industry-mapping";

export type AgeSalaryRow = {
  age_class: AgeClass;
  age_label: string;
  /** 推定年収（円） */
  estimated_annual_yen: number;
  /** 業界カーブの月給（千円）— 表示参考 */
  census_monthly_kjpy: number;
  /** 年齢計に対する倍率 */
  ratio: number;
};

export type AgeSalaryResult = {
  /** 採用したセンサス産業（null = フォールバック）*/
  industry: CensusIndustry | null;
  industry_label: string;
  /** 分母（年齢計の月給、千円）*/
  baseline_monthly_kjpy: number;
  /** 各年代の推計 */
  rows: AgeSalaryRow[];
  /** 表示対象の年代（u19 と 65-69 を除いた 9 年代） */
  display_age_classes: AgeClass[];
  /** 信頼性メモ（表示用） */
  notes: string[];
};

const DEFAULT_DISPLAY_AGE_CLASSES: AgeClass[] = [
  "20-24",
  "25-29",
  "30-34",
  "35-39",
  "40-44",
  "45-49",
  "50-54",
  "55-59",
  "60-64",
];

export function estimateAgeSalary(args: {
  companyAvgAnnualYen: number | null | undefined;
  industryName: string | null | undefined;
}): AgeSalaryResult | null {
  const avg = args.companyAvgAnnualYen;
  if (avg == null || !Number.isFinite(avg) || avg <= 0) return null;

  const industry = mapIndustryNameToCensus(args.industryName);
  const wages = industry ? CENSUS_WAGES[industry] : null;
  const baseline = wages?.total ?? CENSUS_ALL_INDUSTRIES_TOTAL;
  const industry_label = industry
    ? CENSUS_INDUSTRY_LABEL[industry]
    : "全産業（業界マッピング外）";

  const notes: string[] = [];
  if (!industry) {
    notes.push(
      "業界マッピングが見つからないため、全産業の年齢計を基準にしています"
    );
  }

  const rows: AgeSalaryRow[] = AGE_CLASS_ORDER.map((ac) => {
    const census = wages?.byAge?.[ac];
    if (census == null) {
      return {
        age_class: ac,
        age_label: AGE_CLASS_LABEL[ac],
        estimated_annual_yen: 0,
        census_monthly_kjpy: 0,
        ratio: 0,
      };
    }
    const ratio = census / baseline;
    return {
      age_class: ac,
      age_label: AGE_CLASS_LABEL[ac],
      estimated_annual_yen: Math.round(avg * ratio),
      census_monthly_kjpy: census,
      ratio,
    };
  });

  return {
    industry,
    industry_label,
    baseline_monthly_kjpy: baseline,
    rows,
    display_age_classes: DEFAULT_DISPLAY_AGE_CLASSES,
    notes,
  };
}
