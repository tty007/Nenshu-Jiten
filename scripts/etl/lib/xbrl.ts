import JSZip from "jszip";

export type XbrlFact = {
  elementId: string;
  contextRef: string;
  unitRef: string;
  value: string;
};

// Parse the XBRL_TO_CSV (type=5) ZIP. Returns the main facts indexed by
// (elementId, contextRef). The CSV is UTF-16LE, tab-separated, with quoted fields.
export async function parseXbrlCsvZip(buf: Buffer): Promise<Map<string, XbrlFact>> {
  const zip = await JSZip.loadAsync(buf);
  const csvName = Object.keys(zip.files).find(
    (n) => n.startsWith("XBRL_TO_CSV/jpcrp") && n.endsWith(".csv")
  );
  if (!csvName) throw new Error("main XBRL CSV not found in ZIP");
  const u8 = await zip.files[csvName].async("uint8array");
  // strip optional UTF-16LE BOM
  const start = u8[0] === 0xff && u8[1] === 0xfe ? 2 : 0;
  const text = Buffer.from(u8.buffer, u8.byteOffset + start, u8.byteLength - start).toString("utf16le");

  const lines = text.split(/\r?\n/);
  const facts = new Map<string, XbrlFact>();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = parseTsvLine(line);
    if (cols.length < 9) continue;
    const elementId = cols[0];
    const contextRef = cols[2];
    const unitRef = cols[6];
    const value = cols[8];
    if (!elementId || !contextRef) continue;
    const key = `${elementId}|${contextRef}`;
    facts.set(key, { elementId, contextRef, unitRef, value });
  }
  return facts;
}

function parseTsvLine(line: string): string[] {
  // EDINET CSV uses tab separators with each field surrounded by ".
  // No embedded tabs inside quoted fields per spec; values may contain quotes
  // escaped as "". We do a simple split on tabs and strip surrounding quotes.
  return line.split("\t").map(stripQuotes);
}

function stripQuotes(s: string): string {
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/""/g, '"');
  }
  return s;
}

export function getFact(
  facts: Map<string, XbrlFact>,
  elementId: string,
  contextRef: string
): string | null {
  const f = facts.get(`${elementId}|${contextRef}`);
  if (!f) return null;
  const v = f.value;
  if (!v || v === "－" || v === "-") return null;
  return v;
}

export function getNumber(
  facts: Map<string, XbrlFact>,
  elementId: string,
  contextRef: string
): number | null {
  const v = getFact(facts, elementId, contextRef);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function pickFact(
  facts: Map<string, XbrlFact>,
  candidates: Array<{ element: string; context: string }>
): { value: string; element: string; context: string } | null {
  for (const c of candidates) {
    const v = getFact(facts, c.element, c.context);
    if (v !== null) return { value: v, element: c.element, context: c.context };
  }
  return null;
}

export function pickNumber(
  facts: Map<string, XbrlFact>,
  candidates: Array<{ element: string; context: string }>
): number | null {
  const f = pickFact(facts, candidates);
  if (!f) return null;
  const n = Number(f.value);
  return Number.isFinite(n) ? n : null;
}

// --- Field extractors ---------------------------------------------------------

const COVER = "FilingDateInstant";
const CUR_DURATION = "CurrentYearDuration";
const CUR_INSTANT = "CurrentYearInstant";
const CUR_INSTANT_NC = "CurrentYearInstant_NonConsolidatedMember";
const CUR_DURATION_NC = "CurrentYearDuration_NonConsolidatedMember";

export type CompanyMeta = {
  edinetCode: string;
  securitiesCode: string | null;
  name: string;
  nameEn: string | null;
  nameKana: string | null;
  headquarters: string | null;
  representative: string | null;
  fiscalYearEnd: string | null;
  fiscalYearEndMonth: number | null;
  filingDate: string | null;
  accountingStandard: string | null;
};

export function extractCompanyMeta(facts: Map<string, XbrlFact>): CompanyMeta {
  const edinetCode = getFact(facts, "jpdei_cor:EDINETCodeDEI", COVER) ?? "";
  const securitiesCodeRaw = getFact(facts, "jpdei_cor:SecurityCodeDEI", COVER);
  // sec code in XBRL is 5 digits "22170", canonical 4 digits "2217"
  const securitiesCode = securitiesCodeRaw ? securitiesCodeRaw.replace(/0$/, "") : null;
  const name =
    getFact(facts, "jpcrp_cor:CompanyNameCoverPage", COVER) ??
    getFact(facts, "jpdei_cor:FilerNameInJapaneseDEI", COVER) ??
    "";
  const nameEn = getFact(facts, "jpcrp_cor:CompanyNameInEnglishCoverPage", COVER);
  const nameKana = null;
  const headquarters = getFact(
    facts,
    "jpcrp_cor:AddressOfRegisteredHeadquarterCoverPage",
    COVER
  );
  const representative = getFact(
    facts,
    "jpcrp_cor:TitleAndNameOfRepresentativeCoverPage",
    COVER
  );
  const fiscalYearEnd = getFact(facts, "jpdei_cor:CurrentFiscalYearEndDateDEI", COVER);
  // YYYY-MM-DD → 月だけ取り出す
  const fiscalYearEndMonth = fiscalYearEnd
    ? (() => {
        const m = /^(\d{4})-(\d{2})/.exec(fiscalYearEnd);
        if (!m) return null;
        const month = Number(m[2]);
        return month >= 1 && month <= 12 ? month : null;
      })()
    : null;
  const filingDate = getFact(facts, "jpcrp_cor:FilingDateCoverPage", COVER);
  const accountingStandard = getFact(facts, "jpdei_cor:AccountingStandardsDEI", COVER);
  return {
    edinetCode,
    securitiesCode,
    name,
    nameEn,
    nameKana,
    headquarters,
    representative,
    fiscalYearEnd,
    fiscalYearEndMonth,
    filingDate,
    accountingStandard,
  };
}

export type FinancialFacts = {
  fiscalYear: number;
  averageAnnualSalary: number | null;
  averageAge: number | null;
  averageTenureYears: number | null;
  employeeCount: number | null;
  femaleManagerRatio: number | null; // percentage (0-100)
  averageOvertimeHours: number | null;
  revenue: number | null;
  operatingIncome: number | null;
  ordinaryIncome: number | null;
  netIncome: number | null;
};

export function extractFinancialFacts(facts: Map<string, XbrlFact>): FinancialFacts {
  // fiscal_year = year of fiscal-year-end (e.g., 2026-01-31 -> 2025 fiscal year).
  // Convention: fiscal year is the year in which the majority of the period falls.
  // For a Jan 2026 close, period is Feb 2025-Jan 2026 → fiscalYear = 2025.
  const fyEnd = getFact(facts, "jpdei_cor:CurrentFiscalYearEndDateDEI", COVER);
  const fyStart = getFact(facts, "jpdei_cor:CurrentFiscalYearStartDateDEI", COVER);
  let fiscalYear = NaN;
  if (fyStart) fiscalYear = Number(fyStart.slice(0, 4));
  else if (fyEnd) fiscalYear = Number(fyEnd.slice(0, 4)) - 1;

  const rawAverageAnnualSalary = pickNumber(facts, [
    {
      element:
        "jpcrp_cor:AverageAnnualSalaryInformationAboutReportingCompanyInformationAboutEmployees",
      context: CUR_INSTANT_NC,
    },
    {
      element:
        "jpcrp_cor:AverageAnnualSalaryInformationAboutReportingCompanyInformationAboutEmployees",
      context: CUR_INSTANT,
    },
  ]);
  // 上場企業の平均年収レンジに基づく妥当性チェック:
  //   - 一般的な範囲は 200万〜2000万。上限 5000万を超えれば確実に異常値
  //   - 10万円未満 → 千円単位での誤入力が疑わしい(例: 7379 → 7379千円)。
  //     ×1000 して再判定し、妥当範囲なら補正、外れたら null。
  const SALARY_MIN = 1_000_000; // 100万円
  const SALARY_MAX = 50_000_000; // 5000万円
  let averageAnnualSalary: number | null = rawAverageAnnualSalary;
  if (averageAnnualSalary !== null) {
    if (averageAnnualSalary < 100_000) {
      const corrected = averageAnnualSalary * 1000;
      averageAnnualSalary =
        corrected >= SALARY_MIN && corrected <= SALARY_MAX ? corrected : null;
    } else if (averageAnnualSalary > SALARY_MAX) {
      averageAnnualSalary = null;
    } else if (averageAnnualSalary < SALARY_MIN) {
      averageAnnualSalary = null;
    }
  }

  const averageAge = pickNumber(facts, [
    {
      element:
        "jpcrp_cor:AverageAgeYearsInformationAboutReportingCompanyInformationAboutEmployees",
      context: CUR_INSTANT_NC,
    },
    {
      element:
        "jpcrp_cor:AverageAgeYearsInformationAboutReportingCompanyInformationAboutEmployees",
      context: CUR_INSTANT,
    },
  ]);

  const averageTenureYears = pickNumber(facts, [
    {
      element:
        "jpcrp_cor:AverageLengthOfServiceYearsInformationAboutReportingCompanyInformationAboutEmployees",
      context: CUR_INSTANT_NC,
    },
    {
      element:
        "jpcrp_cor:AverageLengthOfServiceYearsInformationAboutReportingCompanyInformationAboutEmployees",
      context: CUR_INSTANT,
    },
  ]);

  // Consolidated employee count preferred; fall back to non-consolidated.
  const employeeCount = pickNumber(facts, [
    { element: "jpcrp_cor:NumberOfEmployees", context: CUR_INSTANT },
    { element: "jpcrp_cor:NumberOfEmployees", context: CUR_INSTANT_NC },
  ]);

  // Female manager ratio is given as fraction 0.188 → store as percent 18.8.
  const femaleRatioFraction = pickNumber(facts, [
    {
      element: "jpcrp_cor:RatioOfFemaleEmployeesInManagerialPositionsMetricsOfReportingCompany",
      context: CUR_INSTANT_NC,
    },
    {
      element: "jpcrp_cor:RatioOfFemaleEmployeesInManagerialPositionsMetricsOfReportingCompany",
      context: CUR_INSTANT,
    },
  ]);
  const femaleManagerRatio =
    femaleRatioFraction !== null ? Math.round(femaleRatioFraction * 1000) / 10 : null;

  // Overtime hours: not always disclosed. Try a few variants.
  const averageOvertimeHours = pickNumber(facts, [
    {
      element: "jpcrp_cor:AverageMonthlyOvertimeHoursOfReportingCompany",
      context: CUR_INSTANT_NC,
    },
    {
      element: "jpcrp_cor:AverageMonthlyOvertimeHoursOfReportingCompany",
      context: CUR_INSTANT,
    },
  ]);

  // 連結 → 単独 の順に候補要素を試すヘルパ。
  const tryConsolidatedFirst = (elements: string[]): number | null => {
    const candidates = elements.flatMap((e) => [
      { element: e, context: CUR_DURATION },
      { element: e, context: CUR_DURATION_NC },
    ]);
    return pickNumber(facts, candidates);
  };

  const revenue = tryConsolidatedFirst([
    "jpcrp_cor:NetSalesSummaryOfBusinessResults",
    "jpcrp_cor:RevenueIFRSSummaryOfBusinessResults",
    "jpcrp_cor:OperatingRevenueSummaryOfBusinessResults",
    "jpcrp_cor:RevenueSummaryOfBusinessResults",
  ]);

  // 営業利益は連結だと jppfs_cor:OperatingIncome (P/L本体のサマリ) を、
  // 単独だと SummaryOfBusinessResults 系を見る必要がある。
  const operatingIncome =
    tryConsolidatedFirst([
      "jpcrp_cor:OperatingIncomeLossSummaryOfBusinessResults",
      "jpcrp_cor:OperatingProfitLossIFRSSummaryOfBusinessResults",
    ]) ??
    pickNumber(facts, [
      { element: "jppfs_cor:OperatingIncome", context: CUR_DURATION },
      { element: "jppfs_cor:OperatingIncome", context: CUR_DURATION_NC },
      { element: "jppfs_cor:OperatingProfitIFRS", context: CUR_DURATION },
    ]);

  const ordinaryIncome = tryConsolidatedFirst([
    "jpcrp_cor:OrdinaryIncomeLossSummaryOfBusinessResults",
  ]);

  const netIncome = tryConsolidatedFirst([
    "jpcrp_cor:ProfitLossAttributableToOwnersOfParentSummaryOfBusinessResults",
    "jpcrp_cor:NetIncomeLossSummaryOfBusinessResults",
    "jpcrp_cor:ProfitLossAttributableToOwnersOfParentIFRSSummaryOfBusinessResults",
    "jpcrp_cor:ProfitLossSummaryOfBusinessResults",
  ]);

  return {
    fiscalYear,
    averageAnnualSalary,
    averageAge,
    averageTenureYears,
    employeeCount,
    femaleManagerRatio,
    averageOvertimeHours,
    revenue,
    operatingIncome,
    ordinaryIncome,
    netIncome,
  };
}
