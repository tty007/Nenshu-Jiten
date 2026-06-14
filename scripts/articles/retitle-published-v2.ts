/**
 * 公開済み salary 記事のタイトルを v2 テンプレ（検索意図最適化版）に書き換える。
 *
 *   v1: 「{社名}の平均年収は{XX}万円！年代別年収や役職別年収・手取り推計情報【{YYYY}年最新】」
 *   v2: 「{社名}の平均年収{XX}万円は本当？30代・40代の手取りまで【{YYYY}年最新】」
 *
 * 平均年収なしの場合は:
 *   v2: 「{社名}の年収はいくら？30代・40代の手取りまで有報から解説【{YYYY}年最新】」
 *
 * generators.ts の buildSalaryTitle は server-only モジュールに依存するため
 * tsx CLI から直接呼べない。同じロジックを本ファイルに inline でコピーする。
 * 変更時は generators.ts と本ファイルを揃えて更新すること。
 *
 * 使い方:
 *   npx tsx scripts/articles/retitle-published-v2.ts          # dry-run
 *   npx tsx scripts/articles/retitle-published-v2.ts --apply  # 実行
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const TITLE_HARD_CAP = 60;

function visualLength(s: string): number {
  let n = 0;
  for (const ch of s) n += /[\x00-\x7F]/.test(ch) ? 0.5 : 1;
  return n;
}

function truncate(s: string, cap: number): string {
  let acc = "";
  let used = 0;
  for (const ch of s) {
    const w = /[\x00-\x7F]/.test(ch) ? 0.5 : 1;
    if (used + w > cap) break;
    acc += ch;
    used += w;
  }
  return acc;
}

function buildTitleV2(companyName: string, avgManYen: number | null, year: number): string {
  const build = (n: string): string =>
    avgManYen != null
      ? `${n}の平均年収${avgManYen}万円は本当？30代・40代の手取りまで【${year}年最新】`
      : `${n}の年収はいくら？30代・40代の手取りまで有報から解説【${year}年最新】`;
  let t = build(companyName);
  if (visualLength(t) > TITLE_HARD_CAP) {
    const fixed = build("");
    const room = TITLE_HARD_CAP - visualLength(fixed) - 1;
    t = build(`${truncate(companyName, Math.max(room, 4))}…`);
  }
  return t;
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "MODE: APPLY (DB will be updated)" : "MODE: dry-run (no writes)");

  const year = new Date().getFullYear();

  // 1. 公開記事 → 紐付企業 → 最新の avg salary
  const { data: artData, error: artErr } = await sb
    .from("articles")
    .select(
      `id, title,
       article_companies(company_id, display_order,
         companies(id, name, financial_metrics(fiscal_year, average_annual_salary)))`,
    )
    .eq("status", "published");
  if (artErr) throw artErr;
  const rows = (artData ?? []) as any[];
  console.log(`published articles: ${rows.length}`);

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const a of rows) {
    const acs = (a.article_companies ?? []).slice().sort(
      (x: any, y: any) => (x.display_order ?? 0) - (y.display_order ?? 0),
    );
    if (acs.length === 0) { failed++; console.error(`  ${a.id}: no company linked`); continue; }
    const co = acs[0].companies;
    if (!co) { failed++; continue; }
    const fms = (co.financial_metrics ?? []) as { fiscal_year: number; average_annual_salary: number | null }[];
    // 最新有報年度
    const sortedFm = fms.slice().sort((x, y) => y.fiscal_year - x.fiscal_year);
    const latestAvgYen = sortedFm[0]?.average_annual_salary ?? null;
    const avgMan = latestAvgYen != null && Number.isFinite(latestAvgYen)
      ? Math.round(latestAvgYen / 10000) : null;

    const newTitle = buildTitleV2(co.name, avgMan, year);
    if (newTitle === a.title) { unchanged++; continue; }

    if (apply) {
      const upd = await sb.from("articles").update({ title: newTitle }).eq("id", a.id);
      if (upd.error) { failed++; console.error(`  UPDATE FAIL ${a.id}: ${upd.error.message}`); continue; }
    }
    updated++;
    if (updated <= 5 || !apply) {
      console.log(`  ${a.id}`);
      console.log(`    old: ${a.title}`);
      console.log(`    new: ${newTitle}`);
    }
  }
  console.log(`\nupdated: ${updated}, unchanged: ${unchanged}, failed: ${failed}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
