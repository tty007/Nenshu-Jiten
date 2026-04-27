/**
 * 失敗したdocsだけを再処理する。failures-2025q4.jsonを読んで、
 * 既知の理由（foreign issuer / non-XBRL ZIP）以外を再実行。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fetchDocBinary, sleep } from "./lib/edinet";
import { STORAGE_BUCKET, supabaseAdmin } from "./lib/supabase";
import {
  extractCompanyMeta,
  extractFinancialFacts,
  parseXbrlCsvZip,
} from "./lib/xbrl";

const DATA_DIR = path.resolve(process.cwd(), "scripts/etl/data");
const FAILURES_FILE = path.join(DATA_DIR, "failures-2025q4.json");
const HISTORICAL_FILE = path.join(DATA_DIR, "historical-docs-2025q4.json");
const TARGET_FILE = path.join(DATA_DIR, "target-companies-2025q4.json");

type FailureRecord = {
  docID: string;
  edinetCode: string;
  filerName: string | null;
  error: string;
};

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

async function main() {
  const failures: FailureRecord[] = JSON.parse(
    await fs.readFile(FAILURES_FILE, "utf8")
  );
  const histDocs: HistoricalDoc[] = JSON.parse(
    await fs.readFile(HISTORICAL_FILE, "utf8")
  );
  const targets: EnrichedTarget[] = JSON.parse(
    await fs.readFile(TARGET_FILE, "utf8")
  );

  // Skip the foreign-issuer ZIP-format failures (not real XBRL)
  const retryable = failures.filter((f) => !f.error.includes("end of central directory"));
  console.log(`retryable failures: ${retryable.length} / ${failures.length}`);

  const docByID = new Map(histDocs.map((d) => [d.docID, d]));
  const indByEc = new Map(targets.map((t) => [t.edinetCode, t.industryCode]));

  const newFailures: FailureRecord[] = [];

  for (const f of retryable) {
    const d = docByID.get(f.docID);
    if (!d) {
      console.log(`skip ${f.docID}: not in historical-docs`);
      continue;
    }
    console.log(`\n${d.docID} (${d.edinetCode} ${d.filerName})`);
    try {
      const zipBuf = await fetchDocBinary(d.docID, 1);
      console.log(`  zip downloaded: ${zipBuf.length} bytes`);
      const storagePath = `${d.edinetCode}/${d.docID}.zip`;
      const upRes = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, zipBuf, {
          contentType: "application/zip",
          upsert: true,
        });
      if (upRes.error) {
        console.log(`  storage error:`, JSON.stringify(upRes.error, null, 2));
        throw new Error(`storage upload: ${JSON.stringify(upRes.error)}`);
      }
      console.log(`  uploaded → ${storagePath}`);

      const csvZip = await fetchDocBinary(d.docID, 5);
      console.log(`  csv zip downloaded: ${csvZip.length} bytes`);
      const facts = await parseXbrlCsvZip(csvZip);
      const meta = extractCompanyMeta(facts);
      const fin = extractFinancialFacts(facts);
      console.log(`  parsed: fy=${fin.fiscalYear} salary=${fin.averageAnnualSalary}`);

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

      // Sanity-check: average_annual_salary column is int (max ~2.1B).
      // Values > 2B are clearly filing errors (e.g. company entered total payroll
      // instead of per-person average). Drop the field rather than overflow.
      const safeSalary =
        fin.averageAnnualSalary !== null && fin.averageAnnualSalary > 2_000_000_000
          ? null
          : fin.averageAnnualSalary;
      if (safeSalary !== fin.averageAnnualSalary) {
        console.log(
          `  WARN: salary ${fin.averageAnnualSalary} exceeds int range — dropped`
        );
      }

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
      console.log(`  OK`);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null
            ? JSON.stringify(e)
            : String(e);
      console.log(`  FAIL: ${msg}`);
      newFailures.push({
        docID: d.docID,
        edinetCode: d.edinetCode,
        filerName: d.filerName,
        error: msg,
      });
    }
    await sleep(100);
  }

  console.log(`\n=== retry summary ===`);
  console.log(`retried: ${retryable.length}`);
  console.log(`still failing: ${newFailures.length}`);
  if (newFailures.length > 0) {
    console.log(`\n=== new failures ===`);
    for (const f of newFailures) {
      console.log(`  ${f.docID} (${f.edinetCode} ${f.filerName}): ${f.error}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
