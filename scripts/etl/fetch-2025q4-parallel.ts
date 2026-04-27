/**
 * 2025年10月〜12月に最新の有価証券報告書(formCode=030000)を提出した企業を特定し、
 * 過去5年分含めてXBRLを取得→パース→Supabaseへロードする。
 *
 * - 並列度10で取得（10倍速）
 * - 5分ごとにプログレスバーと残り時間を表示
 * - 失敗した会社は最後にレポート
 *
 * 使い方:
 *   npx tsx scripts/etl/fetch-2025q4-parallel.ts
 *   npx tsx scripts/etl/fetch-2025q4-parallel.ts --skip-list        # phase1スキップ（既存ファイルを利用）
 *   npx tsx scripts/etl/fetch-2025q4-parallel.ts --skip-historical  # phase2スキップ
 *   npx tsx scripts/etl/fetch-2025q4-parallel.ts --force             # 既存DB行も再処理
 */
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { parse as parseCsv } from "csv-parse/sync";
import { dateRange, fetchDocList, fetchDocBinary, sleep } from "./lib/edinet";
import { STORAGE_BUCKET, supabaseAdmin } from "./lib/supabase";
import {
  extractCompanyMeta,
  extractFinancialFacts,
  parseXbrlCsvZip,
} from "./lib/xbrl";

const DATA_DIR = path.resolve(process.cwd(), "scripts/etl/data");
const TARGET_FILE = path.join(DATA_DIR, "target-companies-2025q4.json");
const HISTORICAL_FILE = path.join(DATA_DIR, "historical-docs-2025q4.json");
const FAILURES_FILE = path.join(DATA_DIR, "failures-2025q4.json");

const TARGET_START = "2025-10-01";
const TARGET_END = "2025-12-31";
const HISTORICAL_START = "2020-01-01"; // 過去5年分
const HISTORICAL_END = "2025-09-30";

const CONCURRENCY = 10;
const PROGRESS_INTERVAL_MS = 5 * 60 * 1000; // 5分

function arg(name: string): string | undefined {
  const pref = `--${name}=`;
  const a = process.argv.find((x) => x.startsWith(pref));
  if (a) return a.slice(pref.length);
  if (process.argv.includes(`--${name}`)) return "true";
  return undefined;
}

// ---------- Parallel map with bounded concurrency -----------------------------

async function pMap<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

// ---------- Progress reporter -------------------------------------------------

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "?";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m${s}s`;
  return `${s}s`;
}

function progressBar(done: number, total: number, width = 30): string {
  if (total <= 0) return "[" + " ".repeat(width) + "]";
  const filled = Math.min(width, Math.round((done / total) * width));
  return "[" + "#".repeat(filled) + "-".repeat(width - filled) + "]";
}

class Progress {
  start = Date.now();
  done = 0;
  failed = 0;
  total: number;
  label: string;
  timer: ReturnType<typeof setInterval> | null = null;

  constructor(label: string, total: number) {
    this.label = label;
    this.total = total;
  }
  startTimer() {
    this.timer = setInterval(() => this.report(), PROGRESS_INTERVAL_MS);
  }
  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  report() {
    const elapsed = (Date.now() - this.start) / 1000;
    const rate = this.done / Math.max(elapsed, 1e-6);
    const remaining = rate > 0 ? (this.total - this.done) / rate : Infinity;
    const pct = ((this.done / Math.max(this.total, 1)) * 100).toFixed(1);
    const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
    console.log(
      `[${ts}] [${this.label}] ${progressBar(this.done, this.total)} ` +
        `${this.done}/${this.total} (${pct}%) ` +
        `OK=${this.done - this.failed} NG=${this.failed} ` +
        `経過=${formatDuration(elapsed)} 残=${formatDuration(remaining)} ` +
        `(${rate.toFixed(2)}/s)`
    );
  }
}

// ---------- EDINET master + industries ----------------------------------------

async function fetchEdinetMaster(): Promise<
  Map<string, { name: string; industry: string; secCode: string; corporateNumber: string }>
> {
  const res = await fetch(
    "https://disclosure2dl.edinet-fsa.go.jp/searchdocument/codelist/Edinetcode.zip",
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (!res.ok) throw new Error(`EDINETコード一覧 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);
  const csvFile = Object.keys(zip.files).find((n) => n.endsWith(".csv"));
  if (!csvFile) throw new Error("EdinetcodeDlInfo.csv not found");
  const u8 = await zip.files[csvFile].async("uint8array");
  const td = new TextDecoder("shift_jis");
  const text = td.decode(u8);
  const lines = text.split(/\r?\n/);
  const csv = lines.slice(1).join("\n");
  const records = parseCsv(csv, { columns: true, skip_empty_lines: true });
  const map = new Map<
    string,
    { name: string; industry: string; secCode: string; corporateNumber: string }
  >();
  for (const r of records as Array<Record<string, string>>) {
    const ec = r["ＥＤＩＮＥＴコード"];
    if (!ec) continue;
    map.set(ec, {
      name: r["提出者名"] ?? "",
      industry: r["提出者業種"] ?? "",
      secCode: r["証券コード"] ?? "",
      corporateNumber: r["提出者法人番号"] ?? "",
    });
  }
  return map;
}

async function fetchIndustryNameToCode(): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin.from("industries").select("code,name");
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.name, r.code]));
}

// ---------- Doc-list scan in parallel -----------------------------------------

type ListedDoc = {
  docID: string;
  edinetCode: string;
  secCode: string | null;
  filerName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  submitDateTime: string | null;
  ordinanceCode: string | null;
  formCode: string | null;
  fetchedFromDate: string;
};

async function fetchDocsForRange(
  start: string,
  end: string,
  label: string
): Promise<ListedDoc[]> {
  const dates = Array.from(dateRange(start, end));
  console.log(
    `[${label}] scanning ${dates.length} dates ${start}〜${end} (concurrency=${CONCURRENCY})`
  );
  const progress = new Progress(label, dates.length);
  progress.startTimer();
  const all: ListedDoc[] = [];
  await pMap(dates, CONCURRENCY, async (date) => {
    let docs: Awaited<ReturnType<typeof fetchDocList>> = [];
    let attempts = 0;
    while (true) {
      try {
        docs = await fetchDocList(date);
        break;
      } catch (e) {
        attempts++;
        if (attempts >= 4) {
          console.warn(`[${label}] ${date}: failed after ${attempts} attempts: ${e}`);
          progress.failed++;
          break;
        }
        await sleep(1000 * attempts);
      }
    }
    for (const d of docs) {
      if (d.docTypeCode !== "120") continue;
      if (d.formCode !== "030000") continue;
      if (!d.edinetCode) continue;
      all.push({
        docID: d.docID,
        edinetCode: d.edinetCode,
        secCode: d.secCode,
        filerName: d.filerName,
        periodStart: d.periodStart,
        periodEnd: d.periodEnd,
        submitDateTime: d.submitDateTime,
        ordinanceCode: d.ordinanceCode,
        formCode: d.formCode,
        fetchedFromDate: date,
      });
    }
    progress.done++;
  });
  progress.stopTimer();
  progress.report();
  console.log(`[${label}] hits=${all.length}`);
  return all;
}

// ---------- Phase 1: identify Q4-2025 target companies ----------------------

type EnrichedTarget = {
  edinetCode: string;
  secCode: string | null;
  filerName: string | null;
  industryName: string | null;
  industryCode: string | null;
  latestDocID: string;
  latestSubmitDateTime: string | null;
  latestPeriodEnd: string | null;
};

async function phase1IdentifyTargets(): Promise<EnrichedTarget[]> {
  if (arg("skip-list") === "true") {
    const data: EnrichedTarget[] = JSON.parse(await fs.readFile(TARGET_FILE, "utf8"));
    console.log(`[phase1] using existing ${TARGET_FILE} (${data.length} companies)`);
    return data;
  }

  console.log(`\n=== Phase 1: 2025-Q4 提出企業の特定 ===`);
  const targetDocs = await fetchDocsForRange(TARGET_START, TARGET_END, "phase1-list");

  const byEc = new Map<string, ListedDoc>();
  for (const d of targetDocs) {
    const cur = byEc.get(d.edinetCode);
    if (!cur || (d.submitDateTime ?? "") > (cur.submitDateTime ?? "")) {
      byEc.set(d.edinetCode, d);
    }
  }
  console.log(`[phase1] unique target companies: ${byEc.size}`);

  console.log(`[phase1] fetching EDINET master CSV...`);
  const master = await fetchEdinetMaster();
  console.log(`[phase1] master rows: ${master.size}`);

  console.log(`[phase1] resolving industry codes...`);
  const indMap = await fetchIndustryNameToCode();

  const enriched: EnrichedTarget[] = Array.from(byEc.values()).map((x) => {
    const m = master.get(x.edinetCode);
    const industryName = m?.industry ?? null;
    const industryCode = industryName ? indMap.get(industryName) ?? null : null;
    return {
      edinetCode: x.edinetCode,
      secCode: x.secCode,
      filerName: m?.name ?? x.filerName,
      industryName,
      industryCode,
      latestDocID: x.docID,
      latestSubmitDateTime: x.submitDateTime,
      latestPeriodEnd: x.periodEnd,
    };
  });
  await fs.writeFile(TARGET_FILE, JSON.stringify(enriched, null, 2), "utf8");
  console.log(`[phase1] saved → ${TARGET_FILE}`);
  return enriched;
}

// ---------- Phase 2: collect historical 有報 ---------------------------------

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

async function phase2CollectHistorical(targets: EnrichedTarget[]): Promise<HistoricalDoc[]> {
  if (arg("skip-historical") === "true") {
    const data: HistoricalDoc[] = JSON.parse(await fs.readFile(HISTORICAL_FILE, "utf8"));
    console.log(`[phase2] using existing ${HISTORICAL_FILE} (${data.length} docs)`);
    return data;
  }

  console.log(`\n=== Phase 2: 過去文書の収集 ===`);
  const targetEcs = new Set(targets.map((t) => t.edinetCode));

  // Re-fetch the target window so we have full periodStart / ordinanceCode (phase1 doc list)
  const targetDocs = await fetchDocsForRange(TARGET_START, TARGET_END, "phase2-target");
  const histDocs = await fetchDocsForRange(HISTORICAL_START, HISTORICAL_END, "phase2-hist");

  const byKey = new Map<string, ListedDoc>();
  for (const d of targetDocs) {
    if (!targetEcs.has(d.edinetCode)) continue;
    byKey.set(d.docID, d);
  }
  for (const d of histDocs) {
    if (!targetEcs.has(d.edinetCode)) continue;
    if (!byKey.has(d.docID)) byKey.set(d.docID, d);
  }

  // Trim to latest 5 per company by periodEnd desc
  const byEc = new Map<string, ListedDoc[]>();
  for (const d of byKey.values()) {
    const arr = byEc.get(d.edinetCode) ?? [];
    arr.push(d);
    byEc.set(d.edinetCode, arr);
  }
  const trimmed: HistoricalDoc[] = [];
  for (const [, docs] of byEc) {
    const sorted = [...docs].sort((a, b) =>
      (b.periodEnd ?? "").localeCompare(a.periodEnd ?? "")
    );
    for (const d of sorted.slice(0, 5)) {
      trimmed.push({
        docID: d.docID,
        edinetCode: d.edinetCode,
        filerName: d.filerName,
        periodStart: d.periodStart,
        periodEnd: d.periodEnd,
        submitDateTime: d.submitDateTime,
        ordinanceCode: d.ordinanceCode,
        formCode: d.formCode,
      });
    }
  }
  console.log(
    `[phase2] total docs: ${byKey.size}, after trim to 5/company: ${trimmed.length} ` +
      `(companies with at least 1 doc: ${byEc.size}/${targets.length})`
  );
  await fs.writeFile(HISTORICAL_FILE, JSON.stringify(trimmed, null, 2), "utf8");
  console.log(`[phase2] saved → ${HISTORICAL_FILE}`);
  return trimmed;
}

// ---------- Phase 3: download + parse + upload (parallel) -------------------

type FailureRecord = {
  docID: string;
  edinetCode: string;
  filerName: string | null;
  error: string;
};

async function phase3Process(
  docs: HistoricalDoc[],
  targets: EnrichedTarget[]
): Promise<FailureRecord[]> {
  console.log(`\n=== Phase 3: XBRL ダウンロード&ロード ===`);
  const indByEc = new Map(targets.map((t) => [t.edinetCode, t.industryCode]));

  let work = docs;
  if (arg("force") !== "true") {
    const { data: existing } = await supabaseAdmin
      .from("raw_xbrl_documents")
      .select("doc_id")
      .not("storage_path", "is", null)
      .not("parsed_at", "is", null);
    const skipSet = new Set((existing ?? []).map((r) => r.doc_id));
    const before = work.length;
    work = work.filter((d) => !skipSet.has(d.docID));
    console.log(
      `[phase3] skip-existing: skipped ${before - work.length}, processing ${work.length}`
    );
  } else {
    console.log(`[phase3] --force: processing all ${work.length}`);
  }

  const failures: FailureRecord[] = [];
  const progress = new Progress("phase3", work.length);
  progress.startTimer();

  // Persist failures incrementally so a crash doesn't lose them
  const flushFailures = async () => {
    try {
      await fs.writeFile(FAILURES_FILE, JSON.stringify(failures, null, 2), "utf8");
    } catch {}
  };

  await pMap(work, CONCURRENCY, async (d) => {
    try {
      // 1) Download type=1 ZIP (full doc) and upload to storage
      const zipBuf = await fetchDocBinary(d.docID, 1);
      const storagePath = `${d.edinetCode}/${d.docID}.zip`;
      const upRes = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, zipBuf, {
          contentType: "application/zip",
          upsert: true,
        });
      if (upRes.error) throw upRes.error;

      // 2) Download type=5 (XBRL_TO_CSV) and parse
      const csvZip = await fetchDocBinary(d.docID, 5);
      const facts = await parseXbrlCsvZip(csvZip);
      const meta = extractCompanyMeta(facts);
      const fin = extractFinancialFacts(facts);

      // 3) raw_xbrl_documents
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

      // 4) companies
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

      // 5) financial_metrics
      // average_annual_salary は int カラム (max ~2.1B)。
      // 2B超は提出会社側の入力ミス (例: 1人平均ではなく総額を入れた) なので NULL に落とす。
      const safeSalary =
        fin.averageAnnualSalary !== null && fin.averageAnnualSalary > 2_000_000_000
          ? null
          : fin.averageAnnualSalary;

      if (Number.isFinite(fin.fiscalYear)) {
        const { error: fErr } = await supabaseAdmin.from("financial_metrics").upsert(
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

      progress.done++;
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null
            ? JSON.stringify(e)
            : String(e);
      failures.push({
        docID: d.docID,
        edinetCode: d.edinetCode,
        filerName: d.filerName,
        error: msg,
      });
      // Best-effort: persist the parse error on the doc row
      try {
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
            parse_error: msg,
          },
          { onConflict: "doc_id" }
        );
      } catch {}
      progress.done++;
      progress.failed++;
      if (failures.length % 5 === 0) await flushFailures();
    }
  });

  progress.stopTimer();
  progress.report();
  await flushFailures();
  console.log(`[phase3] failures saved → ${FAILURES_FILE}`);
  return failures;
}

// ---------- Main --------------------------------------------------------------

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  console.log(
    `concurrency=${CONCURRENCY}, progress every ${PROGRESS_INTERVAL_MS / 60000}min`
  );

  const targets = await phase1IdentifyTargets();
  const histDocs = await phase2CollectHistorical(targets);
  const failures = await phase3Process(histDocs, targets);

  console.log(`\n=== サマリー ===`);
  console.log(`対象企業: ${targets.length}`);
  console.log(`処理対象docs: ${histDocs.length}`);
  console.log(`失敗docs: ${failures.length}`);

  if (failures.length > 0) {
    const byEc = new Map<string, FailureRecord[]>();
    for (const f of failures) {
      const arr = byEc.get(f.edinetCode) ?? [];
      arr.push(f);
      byEc.set(f.edinetCode, arr);
    }
    console.log(`\n=== 失敗した会社 (${byEc.size}社) ===`);
    for (const [ec, fails] of byEc) {
      console.log(`  ${ec} ${fails[0].filerName}: ${fails.length}件失敗`);
      for (const f of fails) {
        console.log(`    - ${f.docID}: ${f.error.slice(0, 120)}`);
      }
    }
  } else {
    console.log(`全件成功`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
