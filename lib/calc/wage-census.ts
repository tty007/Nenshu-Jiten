// 賃金構造基本統計調査（賃金センサス）令和7(2025)年 第５-１表 抜粋
// データソース: lib/company-db/zuhyo-2025Basic SurveyonWage Structure.csv
// 単位: 千円（月給・現金給与額）

export type AgeClass =
  | "u19"
  | "20-24"
  | "25-29"
  | "30-34"
  | "35-39"
  | "40-44"
  | "45-49"
  | "50-54"
  | "55-59"
  | "60-64"
  | "65-69";

export const AGE_CLASS_ORDER: AgeClass[] = [
  "u19",
  "20-24",
  "25-29",
  "30-34",
  "35-39",
  "40-44",
  "45-49",
  "50-54",
  "55-59",
  "60-64",
  "65-69",
];

export const AGE_CLASS_LABEL: Record<AgeClass, string> = {
  u19: "〜19 歳",
  "20-24": "20〜24 歳",
  "25-29": "25〜29 歳",
  "30-34": "30〜34 歳",
  "35-39": "35〜39 歳",
  "40-44": "40〜44 歳",
  "45-49": "45〜49 歳",
  "50-54": "50〜54 歳",
  "55-59": "55〜59 歳",
  "60-64": "60〜64 歳",
  "65-69": "65〜69 歳",
};

/** 各年代に滞在する年数（生涯年収の積算で使用） */
export const AGE_CLASS_YEARS: Record<AgeClass, number> = {
  u19: 0, // 大卒以降を想定するため使わない
  "20-24": 3, // 22-24
  "25-29": 5,
  "30-34": 5,
  "35-39": 5,
  "40-44": 5,
  "45-49": 5,
  "50-54": 5,
  "55-59": 5,
  "60-64": 0, // 60 歳定年想定で算入しない（差替で 5 にも）
  "65-69": 0,
};

export type CensusIndustry =
  | "mining"
  | "construction"
  | "manufacturing"
  | "utilities"
  | "ict"
  | "transport_postal"
  | "wholesale_retail"
  | "finance_insurance"
  | "real_estate_rental"
  | "academic_research"
  | "hospitality_food"
  | "lifestyle_services"
  | "education"
  | "medical_welfare"
  | "compound_services"
  | "other_services";

export const CENSUS_INDUSTRY_LABEL: Record<CensusIndustry, string> = {
  mining: "鉱業，採石業，砂利採取業",
  construction: "建設業",
  manufacturing: "製造業",
  utilities: "電気・ガス・熱供給・水道業",
  ict: "情報通信業",
  transport_postal: "運輸業，郵便業",
  wholesale_retail: "卸売業，小売業",
  finance_insurance: "金融業，保険業",
  real_estate_rental: "不動産業，物品賃貸業",
  academic_research: "学術研究，専門・技術サービス業",
  hospitality_food: "宿泊業，飲食サービス業",
  lifestyle_services: "生活関連サービス業，娯楽業",
  education: "教育，学習支援業",
  medical_welfare: "医療，福祉",
  compound_services: "複合サービス事業",
  other_services: "サービス業（他に分類されないもの）",
};

/**
 * 産業 × 年齢階級別 月給（男女計）。単位 千円。
 * 年齢計と各年代の値を含む。空欄は census 上 “*” か未掲載のもの。
 */
export type WageRow = {
  total: number; // 年齢計
  byAge: Partial<Record<AgeClass, number>>;
  /** 年齢計の平均年齢（参考） */
  avg_age: number;
};

export const CENSUS_WAGES: Record<CensusIndustry, WageRow> = {
  mining: {
    total: 388.3,
    avg_age: 48.5,
    byAge: {
      u19: 235.0,
      "20-24": 285.1,
      "25-29": 327.0,
      "30-34": 396.5,
      "35-39": 435.1,
      "40-44": 492.0,
      "45-49": 410.0,
      "50-54": 401.0,
      "55-59": 412.6,
      "60-64": 339.5,
      "65-69": 295.7,
    },
  },
  construction: {
    total: 366.3,
    avg_age: 45.5,
    byAge: {
      u19: 221.5,
      "20-24": 250.5,
      "25-29": 292.8,
      "30-34": 330.9,
      "35-39": 361.9,
      "40-44": 380.5,
      "45-49": 397.3,
      "50-54": 429.8,
      "55-59": 447.2,
      "60-64": 389.5,
      "65-69": 329.3,
    },
  },
  manufacturing: {
    total: 330.0,
    avg_age: 44.1,
    byAge: {
      u19: 209.0,
      "20-24": 227.1,
      "25-29": 259.3,
      "30-34": 291.2,
      "35-39": 324.4,
      "40-44": 351.8,
      "45-49": 372.8,
      "50-54": 384.7,
      "55-59": 399.2,
      "60-64": 304.0,
      "65-69": 259.4,
    },
  },
  utilities: {
    total: 444.0,
    avg_age: 43.1,
    byAge: {
      u19: 214.2,
      "20-24": 260.7,
      "25-29": 309.9,
      "30-34": 379.5,
      "35-39": 448.8,
      "40-44": 500.4,
      "45-49": 524.7,
      "50-54": 548.0,
      "55-59": 583.3,
      "60-64": 334.6,
      "65-69": 313.4,
    },
  },
  ict: {
    total: 406.0,
    avg_age: 40.2,
    byAge: {
      u19: 205.0,
      "20-24": 262.2,
      "25-29": 308.7,
      "30-34": 363.4,
      "35-39": 410.1,
      "40-44": 456.8,
      "45-49": 491.7,
      "50-54": 491.3,
      "55-59": 516.3,
      "60-64": 451.5,
      "65-69": 385.8,
    },
  },
  transport_postal: {
    total: 312.7,
    avg_age: 48.7,
    byAge: {
      u19: 211.7,
      "20-24": 241.4,
      "25-29": 278.2,
      "30-34": 306.9,
      "35-39": 324.3,
      "40-44": 344.6,
      "45-49": 335.5,
      "50-54": 335.2,
      "55-59": 324.3,
      "60-64": 289.7,
      "65-69": 252.7,
    },
  },
  wholesale_retail: {
    total: 349.1,
    avg_age: 44.3,
    byAge: {
      u19: 198.3,
      "20-24": 241.0,
      "25-29": 272.7,
      "30-34": 302.2,
      "35-39": 336.7,
      "40-44": 361.5,
      "45-49": 385.4,
      "50-54": 418.1,
      "55-59": 423.4,
      "60-64": 332.9,
      "65-69": 261.8,
    },
  },
  finance_insurance: {
    total: 437.0,
    avg_age: 44.2,
    byAge: {
      u19: 203.2,
      "20-24": 266.5,
      "25-29": 309.6,
      "30-34": 378.6,
      "35-39": 448.7,
      "40-44": 494.1,
      "45-49": 521.2,
      "50-54": 532.7,
      "55-59": 495.9,
      "60-64": 382.5,
      "65-69": 370.4,
    },
  },
  real_estate_rental: {
    total: 360.1,
    avg_age: 43.9,
    byAge: {
      u19: 208.1,
      "20-24": 261.7,
      "25-29": 298.2,
      "30-34": 337.3,
      "35-39": 371.7,
      "40-44": 399.2,
      "45-49": 414.3,
      "50-54": 431.1,
      "55-59": 414.6,
      "60-64": 334.6,
      "65-69": 259.8,
    },
  },
  academic_research: {
    total: 440.3,
    avg_age: 42.9,
    byAge: {
      u19: 219.5,
      "20-24": 280.1,
      "25-29": 335.8,
      "30-34": 406.6,
      "35-39": 440.5,
      "40-44": 484.8,
      "45-49": 525.6,
      "50-54": 489.2,
      "55-59": 536.7,
      "60-64": 425.5,
      "65-69": 388.3,
    },
  },
  hospitality_food: {
    total: 277.2,
    avg_age: 43.1,
    byAge: {
      u19: 204.7,
      "20-24": 224.6,
      "25-29": 250.5,
      "30-34": 270.0,
      "35-39": 286.4,
      "40-44": 302.3,
      "45-49": 327.3,
      "50-54": 312.7,
      "55-59": 304.8,
      "60-64": 265.7,
      "65-69": 228.8,
    },
  },
  lifestyle_services: {
    total: 295.2,
    avg_age: 42.3,
    byAge: {
      u19: 208.1,
      "20-24": 229.8,
      "25-29": 269.4,
      "30-34": 285.8,
      "35-39": 308.9,
      "40-44": 324.0,
      "45-49": 338.4,
      "50-54": 336.8,
      "55-59": 330.4,
      "60-64": 275.4,
      "65-69": 232.8,
    },
  },
  education: {
    total: 379.4,
    avg_age: 44.2,
    byAge: {
      u19: 199.1,
      "20-24": 240.9,
      "25-29": 272.9,
      "30-34": 312.1,
      "35-39": 354.3,
      "40-44": 381.3,
      "45-49": 413.4,
      "50-54": 445.3,
      "55-59": 473.3,
      "60-64": 457.3,
      "65-69": 420.9,
    },
  },
  medical_welfare: {
    total: 315.7,
    avg_age: 44.0,
    byAge: {
      u19: 192.4,
      "20-24": 249.0,
      "25-29": 277.3,
      "30-34": 298.8,
      "35-39": 321.5,
      "40-44": 328.6,
      "45-49": 330.0,
      "50-54": 337.0,
      "55-59": 347.8,
      "60-64": 323.3,
      "65-69": 318.8,
    },
  },
  compound_services: {
    total: 319.0,
    avg_age: 44.9,
    byAge: {
      u19: 206.7,
      "20-24": 224.2,
      "25-29": 247.2,
      "30-34": 272.5,
      "35-39": 304.4,
      "40-44": 326.5,
      "45-49": 357.2,
      "50-54": 379.7,
      "55-59": 376.5,
      "60-64": 264.2,
      "65-69": 222.2,
    },
  },
  other_services: {
    total: 284.9,
    avg_age: 45.9,
    byAge: {
      u19: 208.2,
      "20-24": 235.0,
      "25-29": 260.6,
      "30-34": 274.6,
      "35-39": 283.2,
      "40-44": 302.2,
      "45-49": 308.6,
      "50-54": 312.8,
      "55-59": 311.7,
      "60-64": 275.4,
      "65-69": 241.9,
    },
  },
};

/** 全産業 年齢計（第２表 男女計）— 業界が判定不能な時のフォールバック用 */
export const CENSUS_ALL_INDUSTRIES_TOTAL = 340.6;

// =====================================================================
// 役職別賃金（令和7年度）— ALL産業/男女計（千円）
// データソース: lib/company-db/令和7年度役職別賃金.csv
// =====================================================================

export type RoleLevel = "director" | "manager" | "section_chief" | "non_role";

export const ROLE_LABEL: Record<RoleLevel, string> = {
  director: "部長級",
  manager: "課長級",
  section_chief: "係長級",
  non_role: "非役職者",
};

export const ROLE_WAGE: Record<
  RoleLevel,
  { monthly: number; avg_age: number; tenure: number }
> = {
  director: { monthly: 635.8, avg_age: 53.1, tenure: 22.6 },
  manager: { monthly: 529.2, avg_age: 49.5, tenure: 20.9 },
  section_chief: { monthly: 399.2, avg_age: 45.4, tenure: 17.5 },
  non_role: { monthly: 310.5, avg_age: 41.8, tenure: 10.8 },
};

export const ROLE_ORDER: RoleLevel[] = [
  "director",
  "manager",
  "section_chief",
  "non_role",
];

/**
 * 想定する役職ごとの典型的な人員構成比率
 * （上場大企業 ≒ 製造業の慣行を参考に経験則で設定）
 * 部長 5% / 課長 10% / 係長 15% / 非役職 70%
 */
export const ROLE_HEADCOUNT_DEFAULT: Record<RoleLevel, number> = {
  director: 0.05,
  manager: 0.10,
  section_chief: 0.15,
  non_role: 0.70,
};

/**
 * 役職別 月給を上記の人員構成で加重平均した値（千円）
 *  = 0.05*635.8 + 0.10*529.2 + 0.15*399.2 + 0.70*310.5
 * これを「全社平均 月給」の推定値として使い、各役職の倍率を計算する。
 */
export function getWeightedRoleWage(
  weights: Record<RoleLevel, number> = ROLE_HEADCOUNT_DEFAULT
): number {
  return ROLE_ORDER.reduce(
    (sum, role) => sum + ROLE_WAGE[role].monthly * weights[role],
    0
  );
}
