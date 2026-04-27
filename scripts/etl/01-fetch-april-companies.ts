/**
 * 01: 指定期間に有報を提出した事業会社（formCode=030000）の一覧を取得し、
 *     EDINETコード一覧と突き合わせて industry name → code を解決して
 *     scripts/etl/data/target-companies.json に保存する。
 *
 * 使い方:
 *   npx tsx scripts/etl/01-fetch-april-companies.ts                       # デフォルト 2026-01-01 〜 2026-04-26
 *   npx tsx scripts/etl/01-fetch-april-companies.ts --start=2026-01-01 --end=2026-03-31
 */
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { parse as parseCsv } from "csv-parse/sync";
import { dateRange, fetchDocList, sleep } from "./lib/edinet";
import { supabaseAdmin } from "./lib/supabase";

const OUT_DIR = path.resolve(process.cwd(), "scripts/etl/data");

async function fetchEdinetMaster(): Promise<
  Map<string, { name: string; industry: string; secCode: string; corporateNumber: string }>
> {
  const res = await fetch(
    "https://disclosure2dl.edinet-fsa.go.jp/searchdocument/codelist/Edinetcode.zip",
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  if (!res.ok) throw new Error(`EDINETコード一覧 download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);
  const csvFile = Object.keys(zip.files).find((n) => n.endsWith(".csv"));
  if (!csvFile) throw new Error("EdinetcodeDlInfo.csv not found");
  const u8 = await zip.files[csvFile].async("uint8array");
  // EDINET CSV is CP932 (Shift_JIS).
  const td = new TextDecoder("shift_jis");
  const text = td.decode(u8);
  const lines = text.split(/\r?\n/);
  // First line is metadata "ダウンロード実行日,...". Skip it.
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
  const { data, error } = await supabaseAdmin
    .from("industries")
    .select("code,name");
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.name, r.code]));
}

function arg(name: string): string | undefined {
  const pref = `--${name}=`;
  const a = process.argv.find((x) => x.startsWith(pref));
  return a ? a.slice(pref.length) : undefined;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const start = arg("start") ?? "2026-01-01";
  const end = arg("end") ?? "2026-04-26";

  console.log(`[1/3] EDINET ${start}〜${end} の文書一覧を収集中...`);
  const all: Array<{
    docID: string;
    edinetCode: string;
    secCode: string | null;
    filerName: string | null;
    periodEnd: string | null;
    submitDateTime: string | null;
  }> = [];
  for (const date of dateRange(start, end)) {
    const docs = await fetchDocList(date);
    for (const d of docs) {
      if (d.docTypeCode !== "120") continue; // 有価証券報告書
      if (d.formCode !== "030000") continue; // 事業会社の有報のみ
      if (!d.edinetCode) continue;
      all.push({
        docID: d.docID,
        edinetCode: d.edinetCode,
        secCode: d.secCode,
        filerName: d.filerName,
        periodEnd: d.periodEnd,
        submitDateTime: d.submitDateTime,
      });
    }
    await sleep(50);
  }
  console.log(`  → 該当文書 ${all.length} 件 / ユニーク企業 ${new Set(all.map((x) => x.edinetCode)).size} 社`);

  console.log("[2/3] EDINETコード一覧を取得中...");
  const master = await fetchEdinetMaster();
  console.log(`  → master rows: ${master.size}`);

  console.log("[3/3] 業種コードを解決中...");
  const indMap = await fetchIndustryNameToCode();

  const byEc = new Map<string, (typeof all)[number]>();
  for (const x of all) if (!byEc.has(x.edinetCode)) byEc.set(x.edinetCode, x);

  const enriched = Array.from(byEc.values()).map((x) => {
    const m = master.get(x.edinetCode);
    const industryName = m?.industry ?? null;
    const industryCode = industryName ? indMap.get(industryName) ?? null : null;
    return {
      ...x,
      filerName: m?.name ?? x.filerName,
      industryName,
      industryCode,
    };
  });

  const unmappedInd = enriched.filter((x) => x.industryCode === null).length;
  console.log(`  → 業種マッピング成功 ${enriched.length - unmappedInd} 社、NULL ${unmappedInd} 社`);

  const outPath = path.join(OUT_DIR, "target-companies.json");
  await fs.writeFile(outPath, JSON.stringify(enriched, null, 2), "utf8");
  console.log(`saved: ${outPath}`);

  // 法人番号マップ（MHLW突合用）も同時に保存
  const corpMap: Record<string, { name: string; corporate_number: string }> = {};
  for (const x of enriched) {
    const m = master.get(x.edinetCode);
    if (m) {
      corpMap[x.edinetCode] = {
        name: m.name,
        corporate_number: m.corporateNumber,
      };
    }
  }
  const corpPath = path.join(OUT_DIR, "edinet-corporate-numbers.json");
  await fs.writeFile(corpPath, JSON.stringify(corpMap, null, 2), "utf8");
  console.log(`saved: ${corpPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
