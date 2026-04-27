/**
 * 2025年5-6月バッチの最終検証 + 失敗レポート集計
 */
import fs from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "./lib/supabase";

const DATA_DIR = path.resolve(process.cwd(), "scripts/etl/data");
const LABEL = "2025-may-jun";

type Target = {
  edinetCode: string;
  filerName: string | null;
  industryName: string | null;
};
type FetchFailure = {
  docID: string;
  edinetCode: string;
  filerName: string | null;
  error: string;
};
type SummaryFailure = {
  edinetCode: string;
  filerName: string | null;
  reason: string;
};

async function main() {
  const targets: Target[] = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, `target-companies-${LABEL}.json`), "utf8")
  );
  const fetchFailures: FetchFailure[] = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, `failures-${LABEL}.json`), "utf8")
  );
  const summaryFailures: SummaryFailure[] = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, `summary-failures-${LABEL}.json`), "utf8")
  );

  const ecs = targets.map((t) => t.edinetCode);

  // DB state
  let withSummary = 0;
  let withoutSummary = 0;
  const noSummaryCompanies: { ec: string; name: string }[] = [];
  const inDb = new Set<string>();
  for (let i = 0; i < ecs.length; i += 200) {
    const chunk = ecs.slice(i, i + 200);
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("edinet_code, name, summary")
      .in("edinet_code", chunk);
    if (error) throw error;
    for (const r of (data ?? []) as Array<{ edinet_code: string; name: string; summary: string | null }>) {
      inDb.add(r.edinet_code);
      if (r.summary) withSummary++;
      else {
        withoutSummary++;
        noSummaryCompanies.push({ ec: r.edinet_code, name: r.name });
      }
    }
  }
  const notInDb = ecs.filter((e) => !inDb.has(e));

  console.log("=".repeat(60));
  console.log(`2025年5-6月 提出企業バッチ 最終レポート`);
  console.log("=".repeat(60));
  console.log(`対象企業 (5-6月に有報提出): ${targets.length}`);
  console.log(`  └ companies テーブル登録済: ${inDb.size}`);
  console.log(`     ├ summary 設定済み: ${withSummary}`);
  console.log(`     └ summary 未設定: ${withoutSummary}`);
  console.log(`  └ companies 未登録: ${notInDb.length}`);

  // Aggregate fetch failures by company
  const fetchByEc = new Map<string, { name: string | null; docs: number; errs: Set<string> }>();
  for (const f of fetchFailures) {
    if (!fetchByEc.has(f.edinetCode))
      fetchByEc.set(f.edinetCode, { name: f.filerName, docs: 0, errs: new Set() });
    const v = fetchByEc.get(f.edinetCode)!;
    v.docs++;
    let key: string;
    if (f.error.includes("end of central directory")) key = "XBRL ZIP破損";
    else if (f.error.includes("Bad Gateway")) key = "Bad Gateway";
    else if (f.error.includes("Gateway Timeout")) key = "Gateway Timeout";
    else if (f.error.includes("fetch failed")) key = "fetch failed (transient)";
    else key = f.error.slice(0, 50);
    v.errs.add(key);
  }

  console.log(`\n--- XBRL 取得失敗: ${fetchByEc.size} 社 / ${fetchFailures.length} docs ---`);
  const sovereignKeywords = [
    "ハンガリー", "韓国輸出入", "アルゼンチン", "ポーランド", "ルーマニア", "中米経済",
    "中国中信", "チュニジア", "フィンランド地方", "デンマーク地方", "ウルグアイ", "アンデス開発",
    "ＢＮＧ銀行", "スロベニア", "メキシコ", "スウェーデン輸出", "アフリカ輸出", "オーストリア輸出",
    "韓国産業", "フランス預金", "大韓民国", "フィリピン共和国", "インドネシア国営",
  ];
  const sovereign: typeof fetchByEc = new Map();
  const transient: typeof fetchByEc = new Map();
  for (const [ec, v] of fetchByEc) {
    const isSov = sovereignKeywords.some((kw) => (v.name ?? "").includes(kw));
    if (isSov) sovereign.set(ec, v);
    else transient.set(ec, v);
  }

  console.log(`\n  [構造的不能 (外国政府・国際金融機関)] ${sovereign.size} 社:`);
  for (const [ec, v] of sovereign) {
    console.log(`    ${ec.padEnd(7)} ${v.name} (${v.docs}docs)`);
  }
  console.log(`\n  [一時的エラー (リトライ可能)] ${transient.size} 社:`);
  for (const [ec, v] of transient) {
    console.log(`    ${ec.padEnd(7)} ${v.name} (${v.docs}docs) - ${[...v.errs].join(", ")}`);
  }

  console.log(`\n--- 概要生成失敗 (DB上 summary が未設定) ---`);
  if (noSummaryCompanies.length === 0) {
    console.log(`  なし (DB登録済の全 ${inDb.size} 社で生成成功)`);
  } else {
    for (const c of noSummaryCompanies) console.log(`  ${c.ec.padEnd(7)} ${c.name}`);
  }

  console.log(`\n--- companies に未登録の対象企業 (XBRL取得失敗 = 構造的不能のもの) ---`);
  if (notInDb.length === 0) console.log(`  なし`);
  else {
    for (const ec of notInDb) {
      const t = targets.find((x) => x.edinetCode === ec);
      console.log(`  ${ec.padEnd(7)} ${t?.filerName ?? "(unknown)"}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✓ 完了: ${withSummary} / ${targets.length} 社の summary 生成成功`);
  console.log(`  - 完全成功率: ${((withSummary / targets.length) * 100).toFixed(1)}%`);
  console.log(`  - DB登録ベース: ${((withSummary / inDb.size) * 100).toFixed(1)}%`);
  console.log("=".repeat(60));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
