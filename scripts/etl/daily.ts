/**
 * 日次更新スクリプト：直近 N 日分の有報を EDINET から取り込み、
 * 業界平均を再集計し、新規会社の AI 概要を生成する。
 *
 * 使い方:
 *   npx tsx scripts/etl/daily.ts                       # デフォルト 3日分
 *   npx tsx scripts/etl/daily.ts --days=7              # 直近7日分
 *   npx tsx scripts/etl/daily.ts --start=2026-04-25 --end=2026-04-26
 *   npx tsx scripts/etl/daily.ts --concurrency=5       # 並行ワーカー数（デフォルト 3）
 *   npx tsx scripts/etl/daily.ts --skip-summaries      # 概要生成をスキップ
 *
 * GitHub Actions から毎日叩かれる前提（環境変数は secrets で注入）。
 */
import { spawn } from "node:child_process";
import JSZip from "jszip";
import { parse as parseCsv } from "csv-parse/sync";
import {
  dateRange,
  fetchDocBinary,
  fetchDocList,
  sleep,
  type EdinetDoc,
} from "./lib/edinet";
import { STORAGE_BUCKET, supabaseAdmin } from "./lib/supabase";
import {
  extractCompanyMeta,
  extractFinancialFacts,
  parseXbrlCsvZip,
} from "./lib/xbrl";

function arg(name: string): string | undefined {
  const pref = `--${name}=`;
  const a = process.argv.find((x) => x.startsWith(pref));
  if (a) return a.slice(pref.length);
  if (process.argv.includes(`--${name}`)) return "true";
  return undefined;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoUTC(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
}

async function fetchEdinetIndustryMap(
  ecs: string[]
): Promise<Map<string, { industryName: string; corporateNumber: string }>> {
  if (ecs.length === 0) return new Map();
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
  const text = new TextDecoder("shift_jis").decode(u8);
  const lines = text.split(/\r?\n/);
  const records = parseCsv(lines.slice(1).join("\n"), {
    columns: true,
    skip_empty_lines: true,
  }) as Array<Record<string, string>>;

  const wanted = new Set(ecs);
  const map = new Map<string, { industryName: string; corporateNumber: string }>();
  for (const r of records) {
    const ec = r["ＥＤＩＮＥＴコード"];
    if (!wanted.has(ec)) continue;
    map.set(ec, {
      industryName: r["提出者業種"] ?? "",
      corporateNumber: r["提出者法人番号"] ?? "",
    });
  }
  return map;
}

async function loadIndustryNameToCode(): Promise<Map<string, string>> {
  const { data, error } = await supabaseAdmin
    .from("industries")
    .select("code,name");
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.name, r.code]));
}

type ProcessableDoc = Pick<
  EdinetDoc,
  | "docID"
  | "edinetCode"
  | "filerName"
  | "periodStart"
  | "periodEnd"
  | "submitDateTime"
  | "ordinanceCode"
  | "formCode"
>;

async function processOneDoc(
  d: ProcessableDoc,
  industryCode: string | null,
  corporateNumber: string | null
): Promise<"ok" | "fail"> {
  try {
    const ec = d.edinetCode!;
    const docId = d.docID;

    // type=1 ZIP → Storage
    const zipBuf = await fetchDocBinary(docId, 1);
    const storagePath = `${ec}/${docId}.zip`;
    const up = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, zipBuf, {
        contentType: "application/zip",
        upsert: true,
      });
    if (up.error) throw up.error;
    await sleep(60);

    // type=5 CSV → parse
    const csvZip = await fetchDocBinary(docId, 5);
    const facts = await parseXbrlCsvZip(csvZip);
    const meta = extractCompanyMeta(facts);
    const fin = extractFinancialFacts(facts);

    // raw_xbrl_documents
    const { error: rErr } = await supabaseAdmin.from("raw_xbrl_documents").upsert(
      {
        edinet_code: ec,
        doc_id: docId,
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
    if (rErr) throw rErr;

    // companies
    const { data: companyRow, error: cErr } = await supabaseAdmin
      .from("companies")
      .upsert(
        {
          edinet_code: ec,
          securities_code: meta.securitiesCode,
          name: meta.name,
          industry_code: industryCode,
          corporate_number: corporateNumber,
          headquarters: meta.headquarters,
        },
        { onConflict: "edinet_code" }
      )
      .select("id")
      .single();
    if (cErr) throw cErr;

    // financial_metrics
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
            doc_id: docId,
            submitted_at: d.submitDateTime,
          },
          { onConflict: "company_id,fiscal_year" }
        );
      if (fErr) throw fErr;
    }
    return "ok";
  } catch (e) {
    console.error(`  FAIL ${d.docID} (${d.edinetCode}): ${e}`);
    await supabaseAdmin.from("raw_xbrl_documents").upsert(
      {
        edinet_code: d.edinetCode!,
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
    return "fail";
  }
}

async function spawnChild(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))
    );
  });
}

async function main() {
  const start = arg("start") ?? daysAgoUTC(Number(arg("days") ?? "3"));
  const end = arg("end") ?? todayUTC();
  const skipSummaries = arg("skip-summaries") === "true";

  console.log(`[daily] period ${start} 〜 ${end}`);

  // 1. EDINET 期間内の有報を全部拾う
  const docs: ProcessableDoc[] = [];
  for (const date of dateRange(start, end)) {
    let list: EdinetDoc[];
    try {
      list = await fetchDocList(date);
    } catch (e) {
      console.warn(`  ${date}: list error ${e}`);
      await sleep(500);
      continue;
    }
    for (const d of list) {
      if (d.docTypeCode !== "120") continue;
      if (d.formCode !== "030000") continue;
      if (!d.edinetCode) continue;
      docs.push(d as ProcessableDoc);
    }
    await sleep(50);
  }
  console.log(`[daily] EDINET から ${docs.length} 件の有報候補`);

  // 2. すでに DB にある doc_id を除外
  const allIds = docs.map((d) => d.docID);
  const skipIds = new Set<string>();
  if (allIds.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < allIds.length; i += CHUNK) {
      const chunk = allIds.slice(i, i + CHUNK);
      const { data, error } = await supabaseAdmin
        .from("raw_xbrl_documents")
        .select("doc_id")
        .in("doc_id", chunk)
        .not("storage_path", "is", null)
        .not("parsed_at", "is", null);
      if (error) throw error;
      for (const r of data ?? []) skipIds.add(r.doc_id);
    }
  }
  const newDocs = docs.filter((d) => !skipIds.has(d.docID));
  console.log(`[daily] 新規 ${newDocs.length} 件 / 既存スキップ ${skipIds.size} 件`);

  if (newDocs.length === 0) {
    console.log("[daily] 取り込み対象なし。終了。");
    return;
  }

  // 3. 新規 EDINET コードを集めて industry/法人番号 を解決
  const knownEcSet = new Set<string>();
  {
    const ecs = Array.from(new Set(newDocs.map((d) => d.edinetCode!)));
    const CHUNK = 200;
    for (let i = 0; i < ecs.length; i += CHUNK) {
      const chunk = ecs.slice(i, i + CHUNK);
      const { data, error } = await supabaseAdmin
        .from("companies")
        .select("edinet_code")
        .in("edinet_code", chunk);
      if (error) throw error;
      for (const r of data ?? []) knownEcSet.add(r.edinet_code);
    }
  }
  const newEcs = Array.from(
    new Set(newDocs.map((d) => d.edinetCode!).filter((ec) => !knownEcSet.has(ec)))
  );
  console.log(`[daily] 新規企業 ${newEcs.length} 社（EDINETコード一覧で業種解決）`);

  let edinetMaster = new Map<
    string,
    { industryName: string; corporateNumber: string }
  >();
  if (newEcs.length > 0) {
    edinetMaster = await fetchEdinetIndustryMap(newEcs);
  }
  const indNameToCode = await loadIndustryNameToCode();

  // 4. 各 doc を取り込み（並行ワーカー）
  const concurrency = Math.max(1, Number(arg("concurrency") ?? "3"));
  console.log(`[daily] 取り込み開始 concurrency=${concurrency}`);
  let ok = 0;
  let fail = 0;
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const idx = cursor++;
      if (idx >= newDocs.length) return;
      const d = newDocs[idx];
      const ec = d.edinetCode!;
      const m = edinetMaster.get(ec);
      const industryCode = m ? indNameToCode.get(m.industryName) ?? null : null;
      const corporateNumber = m?.corporateNumber || null;
      const r = await processOneDoc(d, industryCode, corporateNumber);
      if (r === "ok") ok++;
      else fail++;
      console.log(`  [${idx + 1}/${newDocs.length}] ${d.docID} (${ec}) ${r}`);
      await sleep(80);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  console.log(`[daily] 取り込み完了 ok=${ok} fail=${fail}`);

  // 5. companies.latest_* を再計算
  console.log("[daily] refresh_company_latest_metrics() 実行");
  const { error: refErr } = await supabaseAdmin.rpc(
    "refresh_company_latest_metrics"
  );
  if (refErr) throw refErr;

  // 6. 業界平均を再集計
  console.log("[daily] 04-compute-industry-averages を実行");
  await spawnChild("npx", [
    "tsx",
    "scripts/etl/04-compute-industry-averages.ts",
  ]);

  // 7. AI 概要をまだ持っていない会社に対して生成
  if (skipSummaries) {
    console.log("[daily] --skip-summaries 指定のため 06 をスキップ");
  } else {
    console.log("[daily] 06-generate-summaries を実行（未生成のみ）");
    await spawnChild("npx", [
      "tsx",
      "scripts/etl/06-generate-summaries.ts",
      "--concurrency=3",
    ]);
  }

  // 8. gBizINFO から HP・設立年月日・資本金・代表者を補完（未取得分のみ）
  if (process.env.GBIZINFO_API_TOKEN) {
    console.log("[daily] 07-import-gbizinfo を実行（未取得分のみ）");
    try {
      await spawnChild("npx", [
        "tsx",
        "scripts/etl/07-import-gbizinfo.ts",
      ]);
    } catch (e) {
      console.warn("[daily] 07 失敗（継続）:", (e as Error).message);
    }
  } else {
    console.log("[daily] GBIZINFO_API_TOKEN 未設定のため 07 をスキップ");
  }

  console.log("[daily] 全処理完了");
}

main().catch((e) => {
  console.error("[daily] FATAL:", e);
  process.exit(1);
});
