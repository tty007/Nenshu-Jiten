/**
 * 02: 49社それぞれについて、過去5年分(2021-04-01以降)の有報(formCode=030000)を
 *     EDINET から探し、scripts/etl/data/historical-docs.json に保存する。
 *     EDINETの文書APIは日付単位の検索のみなので全日付を走査する。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { dateRange, fetchDocList, sleep } from "./lib/edinet";

const DATA_DIR = path.resolve(process.cwd(), "scripts/etl/data");

type AprilCompany = {
  edinetCode: string;
  industryCode: string | null;
  filerName: string | null;
};

type DocRecord = {
  docID: string;
  edinetCode: string;
  filerName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  submitDateTime: string | null;
  ordinanceCode: string | null;
  formCode: string | null;
  fetchedFromDate: string;
};

async function main() {
  const aprilPath = path.join(DATA_DIR, "april-companies.json");
  const aprilCompanies: AprilCompany[] = JSON.parse(
    await fs.readFile(aprilPath, "utf8")
  );
  const targetEcs = new Set(aprilCompanies.map((c) => c.edinetCode));
  console.log(`target companies: ${targetEcs.size}`);

  // 過去5年分。今日(2026-04-26)から遡って5年。
  // 2021-01-01 ~ 2026-04-26 を全日走査。1月期決算は4-5月、12月期決算は3月などに偏る。
  const start = "2021-01-01";
  const end = "2026-04-26";
  const dates = Array.from(dateRange(start, end));
  console.log(`scanning ${dates.length} dates from ${start} to ${end}`);

  const results: DocRecord[] = [];
  const seenDocIds = new Set<string>();
  let processed = 0;
  for (const date of dates) {
    let docs: Awaited<ReturnType<typeof fetchDocList>>;
    try {
      docs = await fetchDocList(date);
    } catch (e) {
      console.warn(`  ${date}: ERROR ${e}`);
      await sleep(1000);
      continue;
    }
    for (const d of docs) {
      if (d.docTypeCode !== "120") continue; // 有価証券報告書
      if (d.formCode !== "030000") continue;
      if (!d.edinetCode || !targetEcs.has(d.edinetCode)) continue;
      if (seenDocIds.has(d.docID)) continue;
      seenDocIds.add(d.docID);
      results.push({
        docID: d.docID,
        edinetCode: d.edinetCode,
        filerName: d.filerName,
        periodStart: d.periodStart,
        periodEnd: d.periodEnd,
        submitDateTime: d.submitDateTime,
        ordinanceCode: d.ordinanceCode,
        formCode: d.formCode,
        fetchedFromDate: date,
      });
    }
    processed++;
    if (processed % 100 === 0) {
      console.log(`  scanned ${processed}/${dates.length} days, hits=${results.length}`);
    }
    await sleep(40);
  }

  // 1社あたりの件数を確認
  const byEc = new Map<string, DocRecord[]>();
  for (const r of results) {
    const arr = byEc.get(r.edinetCode) ?? [];
    arr.push(r);
    byEc.set(r.edinetCode, arr);
  }
  console.log(`\ntotal yuho docs found: ${results.length}`);
  console.log(`companies with at least 1 doc: ${byEc.size}/${targetEcs.size}`);

  const counts = Array.from(byEc.values()).map((v) => v.length);
  counts.sort((a, b) => a - b);
  if (counts.length) {
    console.log(`docs per company: min=${counts[0]} median=${counts[Math.floor(counts.length / 2)]} max=${counts[counts.length - 1]}`);
  }

  // 各社最新5件に絞る
  const trimmed: DocRecord[] = [];
  for (const [, docs] of byEc) {
    const sorted = [...docs].sort((a, b) =>
      (b.periodEnd ?? "").localeCompare(a.periodEnd ?? "")
    );
    trimmed.push(...sorted.slice(0, 5));
  }
  console.log(`after trimming to 5 per company: ${trimmed.length}`);

  const outPath = path.join(DATA_DIR, "historical-docs.json");
  await fs.writeFile(outPath, JSON.stringify(trimmed, null, 2), "utf8");
  console.log(`saved: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
