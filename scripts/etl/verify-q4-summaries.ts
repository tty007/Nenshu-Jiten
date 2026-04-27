/**
 * 384社のsummary生成状況を最終確認する。
 */
import fs from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "./lib/supabase";

const DATA_DIR = path.resolve(process.cwd(), "scripts/etl/data");

async function main() {
  const label = process.argv.find((x) => x.startsWith("--label="))?.slice(8) ?? "2025q4";
  const targets: Array<{ edinetCode: string; filerName: string | null }> = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, `target-companies-${label}.json`), "utf8")
  );
  console.log(`label: ${label}`);
  console.log(`targets: ${targets.length}`);

  const ecs = targets.map((t) => t.edinetCode);
  const inDB: Array<{ edinet_code: string; name: string; summary: string | null }> = [];
  for (let i = 0; i < ecs.length; i += 100) {
    const chunk = ecs.slice(i, i + 100);
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("edinet_code, name, summary")
      .in("edinet_code", chunk);
    if (error) throw error;
    inDB.push(...((data ?? []) as Array<{ edinet_code: string; name: string; summary: string | null }>));
  }
  console.log(`in DB: ${inDB.length}`);
  const ecsInDB = new Set(inDB.map((r) => r.edinet_code));
  const notInDB = ecs.filter((ec) => !ecsInDB.has(ec));
  console.log(`not in DB: ${notInDB.length}`);
  for (const ec of notInDB) {
    const t = targets.find((x) => x.edinetCode === ec);
    console.log(`  ${ec} ${t?.filerName ?? ""}`);
  }
  const withSummary = inDB.filter((r) => r.summary);
  const withoutSummary = inDB.filter((r) => !r.summary);
  console.log(`with summary: ${withSummary.length}`);
  console.log(`without summary: ${withoutSummary.length}`);
  for (const r of withoutSummary) {
    console.log(`  ${r.edinet_code} ${r.name}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
