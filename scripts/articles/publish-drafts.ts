/**
 * draft 状態の salary 記事をまとめて公開する。
 * 同時に、タイトルが v1 (「平均年収はXX万円！...」) のままなら v2 へ刷新する。
 *
 * 使い方:
 *   npx tsx scripts/articles/publish-drafts.ts           # dry-run
 *   npx tsx scripts/articles/publish-drafts.ts --apply   # 実行
 *
 * 公開済み 67 本との集中提出シグナルを避けたい場合は --apply の前に既存公開
 * 件数 / 一括公開の影響を再評価すること（現状: 5 週間前に最初の 67 本公開済み
 * なので、本バッチは「第 2 ロット」として自然な間隔）。
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

  const { data: artData, error: artErr } = await sb
    .from("articles")
    .select(
      `id, title, body_html,
       article_companies(company_id, display_order,
         companies(id, name, financial_metrics(fiscal_year, average_annual_salary)))`,
    )
    .eq("status", "draft");
  if (artErr) throw artErr;
  const rows = (artData ?? []) as any[];
  console.log(`draft articles: ${rows.length}`);

  let published = 0;
  let titleUpdated = 0;
  let skipped = 0;
  let failed = 0;

  for (const a of rows) {
    // 本文が極端に短い draft は誤生成の疑いがあるのでスキップ
    if (!a.body_html || a.body_html.length < 500) {
      console.warn(`  SKIP (body too short) ${a.id}`);
      skipped++;
      continue;
    }
    const acs = (a.article_companies ?? []).slice().sort(
      (x: any, y: any) => (x.display_order ?? 0) - (y.display_order ?? 0),
    );
    if (acs.length === 0) {
      console.error(`  FAIL ${a.id}: no company linked`);
      failed++;
      continue;
    }
    const co = acs[0].companies;
    if (!co) { failed++; continue; }
    const fms = (co.financial_metrics ?? []) as { fiscal_year: number; average_annual_salary: number | null }[];
    const sortedFm = fms.slice().sort((x, y) => y.fiscal_year - x.fiscal_year);
    const latestAvgYen = sortedFm[0]?.average_annual_salary ?? null;
    const avgMan = latestAvgYen != null && Number.isFinite(latestAvgYen)
      ? Math.round(latestAvgYen / 10000) : null;

    const newTitle = buildTitleV2(co.name, avgMan, year);
    const needsTitleUpdate = newTitle !== a.title;

    if (apply) {
      const patch: { status: "published"; title?: string } = { status: "published" };
      if (needsTitleUpdate) patch.title = newTitle;
      const upd = await sb.from("articles").update(patch).eq("id", a.id);
      if (upd.error) {
        console.error(`  UPDATE FAIL ${a.id}: ${upd.error.message}`);
        failed++;
        continue;
      }
    }
    published++;
    if (needsTitleUpdate) titleUpdated++;
    if (published <= 5 || !apply) {
      console.log(`  ${a.id}  -> published${needsTitleUpdate ? " (title v2)" : ""}`);
      if (needsTitleUpdate) {
        console.log(`    old: ${a.title}`);
        console.log(`    new: ${newTitle}`);
      }
    }
  }

  console.log(
    `\npublished: ${published} (of which ${titleUpdated} got v2 title), skipped: ${skipped}, failed: ${failed}`,
  );
}
main().catch((e) => { console.error(e); process.exit(1); });
