export type Industry = {
  code: string;
  name: string;
  parentCode: string | null;
};

export type BrandColor = {
  primary: string;
  from: string;
  to: string;
  onPrimary: string;
};

export type Company = {
  id: string;
  edinetCode: string;
  securitiesCode: string | null;
  name: string;
  nameKana: string | null;
  industryCode: string | null;
  industryName: string | null;
  listedMarket: "プライム" | "スタンダード" | "グロース" | null;
  description: string | null;
  summary: string | null;
  summaryGeneratedAt: string | null;
  summarySourceDocId: string | null;
  websiteUrl: string | null;
  headquarters: string | null;
  foundedYear: number | null;
  foundedAt: string | null; // ISO date (YYYY-MM-DD)
  representative: string | null;
  corporateNumber: string | null;
  capitalStockYen: number | null;
  fiscalYearEndMonth: number | null;
  logoUrl?: string | null;
  brandColor: BrandColor;
  coverImageUrl: string | null;
};

export type FinancialMetric = {
  companyId: string;
  fiscalYear: number;
  averageAnnualSalary: number | null;
  averageAge: number | null;
  averageTenureYears: number | null;
  employeeCount: number | null;
  femaleManagerRatio: number | null;
  averageOvertimeHours: number | null;
  revenue: number | null;
  operatingIncome: number | null;
  ordinaryIncome: number | null;
  netIncome: number | null;
  docId: string | null;
  submittedAt: string | null;
};

export type IndustryAverage = {
  industryCode: string;
  fiscalYear: number;
  avgAnnualSalary: number;
  avgTenureYears: number;
  avgEmployeeCount: number;
  avgFemaleManagerRatio: number | null;
  avgOvertimeHours: number | null;
  sampleSize: number;
};

export type CompanyWithLatestMetrics = Company & {
  latest: FinancialMetric;
  history: FinancialMetric[];
};
