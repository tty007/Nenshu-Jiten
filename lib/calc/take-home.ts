// 手取り（ネット年収）の試算
//
// アルゴリズム：
//   給与所得控除  → 令和6年度の階段表
//   社会保険料    → 一般的な料率（健康+厚生年金+雇用保険+介護保険）の概算
//   所得税        → 累進税率（速算表）+ 復興特別所得税 (×1.021)
//   住民税        → 課税所得 × 10% + 均等割 5,000 円
//   手取り        = 額面 - 社会保険料 - 所得税 - 住民税
//
// 注意：
//   - 配偶者控除・扶養控除・生命保険控除等の個別控除は考慮しない
//   - 介護保険は年齢に応じてオン/オフ
//   - 標準報酬月額の上限は 厚生年金 65万、健康保険 139万。簡略のため
//     厚生年金部分を「年収 800万まで一定、超えると低減」で近似
//   - 都道府県固有の住民税差は無視

export type TakeHomeBreakdown = {
  gross_yen: number;
  /** 給与所得控除 */
  employment_deduction_yen: number;
  /** 社会保険料（健康・厚生年金・雇用・介護） */
  social_insurance_yen: number;
  /** 所得税（復興特別所得税込） */
  income_tax_yen: number;
  /** 住民税（所得割 + 均等割）*/
  resident_tax_yen: number;
  /** 手取り年収 */
  take_home_yen: number;
  /** 月あたり手取り（賞与込みで按分。賞与だけの月は実際は多くなる）*/
  monthly_take_home_yen: number;
  /** 手取り率（手取り / 額面） */
  take_home_rate: number;
};

/** 給与所得控除（令和2年改正以降の階段表）*/
function calcEmploymentDeduction(grossYen: number): number {
  if (grossYen <= 1_625_000) return 550_000;
  if (grossYen <= 1_800_000) return Math.round(grossYen * 0.4 - 100_000);
  if (grossYen <= 3_600_000) return Math.round(grossYen * 0.3 + 80_000);
  if (grossYen <= 6_600_000) return Math.round(grossYen * 0.2 + 440_000);
  if (grossYen <= 8_500_000) return Math.round(grossYen * 0.1 + 1_100_000);
  return 1_950_000; // 850万超は上限
}

/** 社会保険料の概算（料率 約 15%、上限考慮） */
function calcSocialInsurance(grossYen: number, age: number): number {
  // 介護保険は 40-64 歳で適用（本人負担 ~0.91%）
  const careRate = age >= 40 && age <= 64 ? 0.0091 : 0;
  // 一般的な本人負担合算（健康 4.99% + 厚生年金 9.15% + 雇用 0.6% + 介護）
  const baseRate = 0.0499 + 0.0915 + 0.006 + careRate;

  // 厚生年金は標準報酬月額 65万でキャップ。年収 800万が境目のラフな近似
  const PENSION_CAP_BASE = 7_800_000;
  if (grossYen <= PENSION_CAP_BASE) {
    return Math.round(grossYen * baseRate);
  }
  // 800万超：厚生年金部分は固定、健康保険・雇用保険・介護保険のみ追加で課す
  const baseAtCap = PENSION_CAP_BASE * baseRate;
  const upperRate = 0.0499 + 0.006 + careRate; // 健康 + 雇用 + 介護
  const additional = (grossYen - PENSION_CAP_BASE) * upperRate;
  return Math.round(baseAtCap + additional);
}

/** 所得税（速算表 + 復興特別所得税 2.1%） */
function calcIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  if (taxableIncome <= 1_950_000) tax = taxableIncome * 0.05;
  else if (taxableIncome <= 3_300_000) tax = taxableIncome * 0.10 - 97_500;
  else if (taxableIncome <= 6_950_000) tax = taxableIncome * 0.20 - 427_500;
  else if (taxableIncome <= 9_000_000) tax = taxableIncome * 0.23 - 636_000;
  else if (taxableIncome <= 18_000_000) tax = taxableIncome * 0.33 - 1_536_000;
  else if (taxableIncome <= 40_000_000) tax = taxableIncome * 0.40 - 2_796_000;
  else tax = taxableIncome * 0.45 - 4_796_000;
  return Math.round(tax * 1.021); // 復興特別所得税
}

/** 住民税（所得割 10% + 均等割 5,000円） */
function calcResidentTax(taxableForResident: number): number {
  if (taxableForResident <= 0) return 5_000;
  return Math.round(taxableForResident * 0.10) + 5_000;
}

/**
 * 額面年収から手取りと内訳を試算する
 *
 * @param grossYen 額面年収（円）
 * @param age 推定年齢（介護保険の適用判定）。デフォルト 35
 */
export function estimateTakeHome(
  grossYen: number,
  age: number = 35
): TakeHomeBreakdown | null {
  if (!Number.isFinite(grossYen) || grossYen <= 0) return null;

  const employmentDeduction = calcEmploymentDeduction(grossYen);
  const social = calcSocialInsurance(grossYen, age);

  // 所得税の課税所得（基礎控除 48 万）
  const taxableForIncome = Math.max(
    0,
    grossYen - employmentDeduction - social - 480_000
  );
  const incomeTax = calcIncomeTax(taxableForIncome);

  // 住民税の課税所得（基礎控除 43 万）
  const taxableForResident = Math.max(
    0,
    grossYen - employmentDeduction - social - 430_000
  );
  const residentTax = calcResidentTax(taxableForResident);

  const takeHome = grossYen - social - incomeTax - residentTax;

  return {
    gross_yen: grossYen,
    employment_deduction_yen: employmentDeduction,
    social_insurance_yen: social,
    income_tax_yen: incomeTax,
    resident_tax_yen: residentTax,
    take_home_yen: Math.max(0, Math.round(takeHome)),
    monthly_take_home_yen: Math.max(0, Math.round(takeHome / 12)),
    take_home_rate: grossYen > 0 ? takeHome / grossYen : 0,
  };
}

/** よく参照される額面年収レベルでの手取りを一括計算（参考表用） */
export function estimateTakeHomeReferenceTable(age: number = 35): TakeHomeBreakdown[] {
  const REF_LEVELS = [3_000_000, 4_000_000, 5_000_000, 7_000_000, 10_000_000, 15_000_000];
  return REF_LEVELS
    .map((y) => estimateTakeHome(y, age))
    .filter((x): x is TakeHomeBreakdown => x !== null);
}
