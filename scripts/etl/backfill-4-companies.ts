/**
 * E05584(出前館), E32156(グローバルキッズCOMPANY), E02352(IMV), E33040(テモナ) の
 * 5年分を再処理する。
 *
 *   - 申告された平均年間給与 > 2B の場合は /1000 補正(提出会社の入力ミスとみなす)
 *   - "_CorporateSharedMember" 接尾辞付きのコンテキストもサーチ対象に追加
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fetchDocBinary, sleep } from "./lib/edinet";
import { STORAGE_BUCKET, supabaseAdmin } from "./lib/supabase";
import {
  extractCompanyMeta,
  extractFinancialFacts,
  parseXbrlCsvZip,
  pickNumber,
} from "./lib/xbrl";

const DATA_DIR = path.resolve(process.cwd(), "scripts/etl/data");
const HISTORICAL_FILE = path.join(DATA_DIR, "historical-docs-2025q4.json");
const TARGET_FILE = path.join(DATA_DIR, "target-companies-2025q4.json");

const TARGET_ECS = new Set(["E05584", "E32156", "E02352", "E33040"]);

type HistoricalDoc = {
  docID: string;
  edinetCode: string;
  filerName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  submitDateTime: string | null;
  ordinanceCode: string | null;
  formCode: string | null;
};

type EnrichedTarget = {
  edinetCode: string;
  industryCode: string | null;
};

const SALARY_ELEMENT =
  "jpcrp_cor:AverageAnnualSalaryInformationAboutReportingCompanyInformationAboutEmployees";

// Try the standard contexts first, then "_CorporateSharedMember" variants which
// some companies (e.g. テモナ) use for the same fact.
const SALARY_CONTEXTS = [
  "CurrentYearInstant_NonConsolidatedMember",
  "CurrentYearInstant",
  "CurrentYearInstant_NonConsolidatedMember_CorporateSharedMember",
  "CurrentYearInstant_CorporateSharedMember",
];

function correctSalary(raw: number | null): { value: number | null; corrected: boolean } {
  if (raw === null) return { value: null, corrected: false };
  if (raw > 2_000_000_000) return { value: Math.round(raw / 1000), corrected: true };
  return { value: raw, corrected: false };
}

async function main() {
  const docs: HistoricalDoc[] = JSON.parse(await fs.readFile(HISTORICAL_FILE, "utf8"));
  const targets: EnrichedTarget[] = JSON.parse(await fs.readFile(TARGET_FILE, "utf8"));
  const indByEc = new Map(targets.map((t) => [t.edinetCode, t.industryCode]));

  const work = docs.filter((d) => TARGET_ECS.has(d.edinetCode));
  work.sort((a, b) =>
    a.edinetCode.localeCompare(b.edinetCode) ||
    (b.periodEnd ?? "").localeCompare(a.periodEnd ?? "")
  );
  console.log(`processing ${work.length} docs across ${TARGET_ECS.size} companies`);

  const stats = { ok: 0, fail: 0, corrected: 0, salaryFilled: 0 };

  for (const d of work) {
    const tag = `${d.edinetCode} fy_end=${d.periodEnd} ${d.docID}`;
    try {
      const csvZip = await fetchDocBinary(d.docID, 5);
      const facts = await parseXbrlCsvZip(csvZip);
      const meta = extractCompanyMeta(facts);
      const fin = extractFinancialFacts(facts);

      // Override: re-pick salary using the extended context list
      const rawSalary = pickNumber(
        facts,
        SALARY_CONTEXTS.map((c) => ({ element: SALARY_ELEMENT, context: c }))
      );
      const { value: safeSalary, corrected } = correctSalary(rawSalary);
      if (corrected) stats.corrected++;
      if (safeSalary !== null) stats.salaryFilled++;

      // Confirm the storage path / raw row is already present (from initial run)
      const storagePath = `${d.edinetCode}/${d.docID}.zip`;

      const { error: rawErr } = await supabaseAdmin
        .from("raw_xbrl_documents")
        .upsert(
          {
            edinet_code: d.edinetCode,
            doc_id: d.docID,
            ordinance_code: d.ordinanceCode,
            form_code: d.formCode,
            doc_type_code: "120",
            fiscal_year: Number.isFinite(fin.fiscalYear) ? fin.fiscalYear : null,
            period_start: d.periodStart,
            period_end: d.periodEnd,
            submitted_at: d.submitDateTime,
            filer_name: d.filerName ?? meta.name,
            storage_path: storagePath,
            parsed_at: new Date().toISOString(),
            parse_error: null,
          },
          { onConflict: "doc_id" }
        );
      if (rawErr) throw rawErr;

      const industryCode = indByEc.get(d.edinetCode) ?? null;
      const { data: companyRow, error: cErr } = await supabaseAdmin
        .from("companies")
        .upsert(
          {
            edinet_code: d.edinetCode,
            securities_code: meta.securitiesCode,
            name: meta.name,
            industry_code: industryCode,
            headquarters: meta.headquarters,
            description: null,
          },
          { onConflict: "edinet_code" }
        )
        .select("id")
        .single();
      if (cErr) throw cErr;

      if (Number.isFinite(fin.fiscalYear)) {
        const { error: fErr } = await supabaseAdmin
          .from("financial_metrics")
          .upsert(
            {
              company_id: companyRow.id,
              fiscal_year: fin.fiscalYear,
              average_annual_salary: safeSalary,
              average_age: fin.averageAge,
              average_tenure_years: fin.averageTenureYears,
              employee_count: fin.employeeCount,
              female_manager_ratio: fin.femaleManagerRatio,
              average_overtime_hours: fin.averageOvertimeHours,
              revenue: fin.revenue,
              operating_income: fin.operatingIncome,
              ordinary_income: fin.ordinaryIncome,
              net_income: fin.netIncome,
              doc_id: d.docID,
              submitted_at: d.submitDateTime,
            },
            { onConflict: "company_id,fiscal_year" }
          );
        if (fErr) throw fErr;
      }

      const note = corrected
        ? `salary=${safeSalary} (raw=${rawSalary}, /1000補正)`
        : `salary=${safeSalary ?? "null"}`;
      console.log(`OK  ${tag} fy=${fin.fiscalYear} ${note}`);
      stats.ok++;
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : typeof e === "object" && e !== null ? JSON.stringify(e) : String(e);
      console.log(`NG  ${tag}: ${msg}`);
      stats.fail++;
    }
    await sleep(80);
  }

  console.log(`\n=== summary ===`);
  console.log(`ok=${stats.ok} fail=${stats.fail} /1000補正=${stats.corrected} salary値あり=${stats.salaryFilled}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
