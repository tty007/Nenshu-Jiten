/**
 * 03: historical-docs.json の各docを処理する。
 *   1) type=1 ZIP を取得して Supabase Storage (xbrl-documents) に保存
 *   2) type=5 (XBRL_TO_CSV) を取得してパース
 *   3) raw_xbrl_documents を upsert
 *   4) companies / financial_metrics を upsert
 *
 *   引数 --limit N で最初のN件のみ処理（パイロット用）。
 *   引数 --edinet=Exxxxx で特定企業のみ処理。
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

type DocRecord = {
  docID: string;
  edinetCode: string;
  filerName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  submitDateTime: string | null;
  ordinanceCode: string | null;
  formCode: string | null;
};

type AprilCompany = {
  edinetCode: string;
  industryCode: string | null;
  filerName: string | null;
  secCode: string | null;
};

function arg(name: string): string | undefined {
  const pref = `--${name}=`;
  const a = process.argv.find((x) => x.startsWith(pref));
  if (a) return a.slice(pref.length);
  if (process.argv.includes(`--${name}`)) return "true";
  return undefined;
}

async function main() {
  const docs: DocRecord[] = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, "historical-docs.json"), "utf8")
  );
  const targetCompanies: AprilCompany[] = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, "target-companies.json"), "utf8")
  );
  const indByEc = new Map(
    targetCompanies.map((c) => [c.edinetCode, c.industryCode])
  );

  const limit = arg("limit") ? Number(arg("limit")) : undefined;
  const onlyEdinet = arg("edinet");
  const skipExisting = arg("skip-existing") === "true";

  let work = docs;
  if (onlyEdinet) work = work.filter((d) => d.edinetCode === onlyEdinet);
  if (skipExisting) {
    const { data: existing } = await supabaseAdmin
      .from("raw_xbrl_documents")
      .select("doc_id")
      .not("storage_path", "is", null)
      .not("parsed_at", "is", null);
    const skipSet = new Set((existing ?? []).map((r) => r.doc_id));
    const before = work.length;
    work = work.filter((d) => !skipSet.has(d.docID));
    console.log(`skip-existing: ${before - work.length} docs already processed, skipping`);
  }
  if (limit !== undefined) work = work.slice(0, limit);

  console.log(`processing ${work.length} documents`);

  let ok = 0;
  let fail = 0;
  for (let i = 0; i < work.length; i++) {
    const d = work[i];
    const tag = `[${i + 1}/${work.length}] ${d.docID} (${d.edinetCode})`;
    try {
      // 1) ZIP取得 (type=1) and upload
      const zipBuf = await fetchDocBinary(d.docID, 1);
      const storagePath = `${d.edinetCode}/${d.docID}.zip`;
      const uploadRes = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, zipBuf, {
          contentType: "application/zip",
          upsert: true,
        });
      if (uploadRes.error) throw uploadRes.error;

      await sleep(60);

      // 2) CSV取得 (type=5) and parse
      const csvZip = await fetchDocBinary(d.docID, 5);
      const facts = await parseXbrlCsvZip(csvZip);
      const meta = extractCompanyMeta(facts);
      const fin = extractFinancialFacts(facts);

      // 3) upsert raw_xbrl_documents
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
          },
          { onConflict: "doc_id" }
        );
      if (rawErr) throw rawErr;

      // 4) upsert companies (latest filing wins for metadata)
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
            representative: meta.representative,
            fiscal_year_end_month: meta.fiscalYearEndMonth,
            description: null,
          },
          { onConflict: "edinet_code" }
        )
        .select("id")
        .single();
      if (cErr) throw cErr;

      // 5) upsert financial_metrics
      if (Number.isFinite(fin.fiscalYear)) {
        const { error: fErr } = await supabaseAdmin
          .from("financial_metrics")
          .upsert(
            {
              company_id: companyRow.id,
              fiscal_year: fin.fiscalYear,
              average_annual_salary: fin.averageAnnualSalary,
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

      ok++;
      console.log(`${tag} OK fy=${fin.fiscalYear} salary=${fin.averageAnnualSalary} rev=${fin.revenue}`);
    } catch (e) {
      fail++;
      console.error(`${tag} FAIL: ${e}`);
      // still record the parse error
      await supabaseAdmin.from("raw_xbrl_documents").upsert(
        {
          edinet_code: d.edinetCode,
          doc_id: d.docID,
          ordinance_code: d.ordinanceCode,
          form_code: d.formCode,
          doc_type_code: "120",
          period_start: d.periodStart,
          period_end: d.periodEnd,
          submitted_at: d.submitDateTime ?? new Date().toISOString(),
          filer_name: d.filerName,
          parse_error: String(e),
        },
        { onConflict: "doc_id" }
      );
    }
    await sleep(80);
  }
  console.log(`\ndone: ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
