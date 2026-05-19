/**
 * 既存 draft の全 AI セクションを新テンプレで再生成し body_html を上書きする。
 *
 * 仕組み:
 *   - status='draft' かつ body_html が一定長以上（実体のあるドラフト）を対象
 *   - 各記事につき SALARY_SECTIONS を順次 generateSection で生成
 *   - 結合して body_html を上書き
 *   - 上書き前に旧本文を /tmp/regen-backup-<timestamp>/<articleId>.html へ保存
 *   - --concurrency 件を記事レベルで並列実行（既定 5）
 *
 * 使い方:
 *   NODE_OPTIONS='--conditions=react-server' npx tsx scripts/articles/regen-all-drafts.ts --dry
 *   NODE_OPTIONS='--conditions=react-server' npx tsx scripts/articles/regen-all-drafts.ts --limit=5
 *   NODE_OPTIONS='--conditions=react-server' npx tsx scripts/articles/regen-all-drafts.ts --concurrency=5
 *
 * フラグ:
 *   --dry           : 実 OpenAI を呼ばず対象一覧だけ出す
 *   --limit=N       : 先頭 N 件だけ処理
 *   --articleId=X   : 特定の 1 件だけ処理
 *   --offset=N      : N 件スキップして開始
 *   --concurrency=N : 記事レベルの並列度（既定 5）
 *   --skipBackupDir=DIR : 指定したバックアップディレクトリに既に存在する記事はスキップ（中断分の再開用）
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { loadSalaryArticleContext } from "../../lib/admin/articles/salary-template/data";
import {
  buildSalaryTitle,
  detectHallucinations,
  generateSection,
} from "../../lib/admin/articles/salary-template/generators";
import { SALARY_SECTIONS } from "../../lib/admin/articles/salary-template/sections";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type Args = {
  dry: boolean;
  limit: number | null;
  offset: number;
  articleId: string | null;
  concurrency: number;
  skipBackupDir: string | null;
  rescanOnly: boolean;
  rescanPlaceholder: boolean;
};
function parseArgs(): Args {
  const a = process.argv.slice(2);
  let dry = false;
  let limit: number | null = null;
  let offset = 0;
  let articleId: string | null = null;
  let concurrency = 5;
  let skipBackupDir: string | null = null;
  let rescanOnly = false;
  let rescanPlaceholder = false;
  for (const v of a) {
    if (v === "--dry") dry = true;
    else if (v === "--rescanOnly") rescanOnly = true;
    else if (v === "--rescanPlaceholder") rescanPlaceholder = true;
    else if (v.startsWith("--limit=")) limit = Number(v.slice("--limit=".length));
    else if (v.startsWith("--offset=")) offset = Number(v.slice("--offset=".length));
    else if (v.startsWith("--articleId="))
      articleId = v.slice("--articleId=".length);
    else if (v.startsWith("--concurrency="))
      concurrency = Math.max(1, Number(v.slice("--concurrency=".length)));
    else if (v.startsWith("--skipBackupDir="))
      skipBackupDir = v.slice("--skipBackupDir=".length);
  }
  return { dry, limit, offset, articleId, concurrency, skipBackupDir, rescanOnly, rescanPlaceholder };
}

async function fetchSummaries(articleIds: string[]): Promise<Map<string, string>> {
  // articles → article_companies (display_order=1) → companies.summary をバッチ取得。
  // detectHallucinations の allowList に渡し、summary に既出の語を「未根拠」と誤判定しないようにする。
  const out = new Map<string, string>();
  if (articleIds.length === 0) return out;

  const CHUNK = 200;
  type AcRow = { article_id: string; company_id: string; display_order: number };
  const acRows: AcRow[] = [];
  for (let i = 0; i < articleIds.length; i += CHUNK) {
    const chunk = articleIds.slice(i, i + CHUNK);
    const r = await sb
      .from("article_companies")
      .select("article_id, company_id, display_order")
      .in("article_id", chunk);
    if (r.error || !r.data) continue;
    for (const row of r.data as any[]) acRows.push(row as AcRow);
  }
  // article_id ごとに display_order 最小の company_id を採用
  const firstCompanyByArticle = new Map<string, string>();
  for (const row of acRows) {
    const cur = firstCompanyByArticle.get(row.article_id);
    if (cur == null) firstCompanyByArticle.set(row.article_id, row.company_id);
  }
  const sortedAc = acRows.sort((a, b) => a.display_order - b.display_order);
  firstCompanyByArticle.clear();
  for (const row of sortedAc) {
    if (!firstCompanyByArticle.has(row.article_id)) {
      firstCompanyByArticle.set(row.article_id, row.company_id);
    }
  }

  const companyIds = Array.from(new Set(firstCompanyByArticle.values()));
  const summaryByCompany = new Map<string, string>();
  for (let i = 0; i < companyIds.length; i += CHUNK) {
    const chunk = companyIds.slice(i, i + CHUNK);
    const r = await sb.from("companies").select("id, summary, description").in("id", chunk);
    if (r.error || !r.data) continue;
    for (const co of r.data as any[]) {
      summaryByCompany.set(co.id as string, (co.summary ?? co.description ?? "") as string);
    }
  }

  for (const [aid, cid] of firstCompanyByArticle.entries()) {
    out.set(aid, summaryByCompany.get(cid) ?? "");
  }
  return out;
}

async function filterRescan(
  rows: { id: string; title: string; body_len: number; body_html: string }[]
): Promise<{ id: string; title: string; body_len: number; hits: string[] }[]> {
  // 現存 body_html に対して detectHallucinations を新ルールで再走査。
  // 各記事の summary を allowList に渡し、summary 由来の語は許容する。
  // （例: summary に「海外展開」と書いてあれば本文に「海外展開」が出てもデータ由来）
  const summaries = await fetchSummaries(rows.map((r) => r.id));
  const out: { id: string; title: string; body_len: number; hits: string[] }[] = [];
  for (const r of rows) {
    const allow = summaries.get(r.id) ?? "";
    const hits = detectHallucinations(r.body_html, allow);
    if (hits.length > 0) {
      out.push({ id: r.id, title: r.title, body_len: r.body_len, hits });
    }
  }
  return out;
}

async function listTargets(args: Args): Promise<{ id: string; title: string; body_len: number }[]> {
  if (args.articleId) {
    const { data, error } = await sb
      .from("articles")
      .select("id, title, body_html")
      .eq("id", args.articleId)
      .maybeSingle();
    if (error || !data) throw error ?? new Error("article not found");
    return [
      {
        id: (data as any).id,
        title: (data as any).title ?? "",
        body_len: ((data as any).body_html ?? "").length,
      },
    ];
  }
  const { data, error } = await sb
    .from("articles")
    .select("id, title, body_html, updated_at")
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  let rows = ((data ?? []) as any[])
    .filter((r) => (r.body_html ?? "").length > 1000)
    .map((r) => ({
      id: r.id as string,
      title: (r.title as string) ?? "",
      body_len: ((r.body_html as string) ?? "").length,
      body_html: (r.body_html as string) ?? "",
    }));

  if (args.rescanPlaceholder) {
    const PLACEHOLDER = "同業界の比較データを準備中です";
    const before = rows.length;
    rows = rows.filter((r) => r.body_html.includes(PLACEHOLDER));
    console.log(`Rescan placeholder: ${rows.length}/${before} drafts contain peer-section placeholder`);
  }

  if (args.rescanOnly) {
    const hits = await filterRescan(rows);
    console.log(`Rescan: ${hits.length}/${rows.length} drafts have hallucination hits`);
    hits.slice(0, 30).forEach((h) =>
      console.log(`  - ${h.id}  ${h.title.slice(0, 50)}  → ${h.hits.join(" / ")}`)
    );
    rows = hits.map((h) => ({
      id: h.id,
      title: h.title,
      body_len: h.body_len,
      body_html: "",
    }));
  }

  if (args.offset > 0) rows = rows.slice(args.offset);
  if (args.limit != null) rows = rows.slice(0, args.limit);
  return rows.map(({ body_html: _b, ...rest }) => rest);
}

function fmtSec(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m${r.toString().padStart(2, "0")}s`;
}

async function regenOne(
  articleId: string,
  backupDir: string,
  dry: boolean
): Promise<{
  ok: boolean;
  cost_usd: number;
  warnings: string[];
  err?: string;
}> {
  const ctxRes = await loadSalaryArticleContext(articleId);
  if (!ctxRes.ok) return { ok: false, cost_usd: 0, warnings: [], err: ctxRes.error };
  const ctx = ctxRes.data;

  const htmlParts: string[] = [];
  const warnings: string[] = [];
  let cost = 0;

  for (const sec of SALARY_SECTIONS) {
    if (dry) continue;
    const r = await generateSection({
      sectionId: sec.id,
      ctx,
      model: "gpt-4o-mini",
    });
    if (!r.ok) {
      return { ok: false, cost_usd: cost, warnings, err: `§${sec.id}: ${r.error}` };
    }
    htmlParts.push(r.data.html);
    cost += r.data.usage.cost_usd ?? 0;
    if (r.data.warnings) {
      for (const w of r.data.warnings) warnings.push(`§${sec.id} ${w}`);
    }
  }

  if (dry) return { ok: true, cost_usd: 0, warnings: [] };

  const title = buildSalaryTitle(ctx).title;
  const body_html = htmlParts.join("\n\n").trim();

  // 旧本文をバックアップ
  const oldRes = await sb
    .from("articles")
    .select("body_html, title")
    .eq("id", articleId)
    .maybeSingle();
  if (!oldRes.error && oldRes.data) {
    const old = oldRes.data as any;
    const safeTitle = (old.title ?? "").replace(/[^\w一-鿿]/g, "_").slice(0, 40);
    fs.writeFileSync(
      path.join(backupDir, `${articleId}__${safeTitle}.html`),
      `<!-- title: ${old.title}\n     id: ${articleId}\n     backed_up_at: ${new Date().toISOString()} -->\n${old.body_html ?? ""}`,
      "utf8"
    );
  }

  const upd = await sb
    .from("articles")
    .update({
      title,
      body_html,
      body_json: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId);
  if (upd.error) {
    return { ok: false, cost_usd: cost, warnings, err: `save: ${upd.error.message}` };
  }
  return { ok: true, cost_usd: cost, warnings };
}

async function main() {
  const args = parseArgs();
  let targets = await listTargets(args);

  // 中断分の再開: 指定バックアップディレクトリに既に存在する記事はスキップ
  if (args.skipBackupDir && fs.existsSync(args.skipBackupDir)) {
    const existing = new Set(
      fs
        .readdirSync(args.skipBackupDir)
        .map((f) => f.split("__")[0])
        .filter((s) => s.length > 0)
    );
    const before = targets.length;
    targets = targets.filter((t) => !existing.has(t.id));
    console.log(
      `Skipping ${before - targets.length} already-processed article(s) found in ${args.skipBackupDir}`
    );
  }

  console.log(
    `Targets: ${targets.length} draft(s)${args.dry ? "  (DRY RUN)" : ""}${args.limit ? ` (limit=${args.limit})` : ""}${args.offset ? ` (offset=${args.offset})` : ""}  concurrency=${args.concurrency}`
  );

  // バックアップ用ディレクトリ
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join("/tmp", `regen-backup-${stamp}`);
  if (!args.dry) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`Backups → ${backupDir}`);
  }

  if (targets.length === 0) {
    console.log("(nothing to do)");
    return;
  }

  if (args.dry) {
    targets.forEach((t, i) =>
      console.log(`  ${(i + 1).toString().padStart(3)}.  ${t.id}  len=${t.body_len.toString().padStart(6)}  ${t.title.slice(0, 60)}`)
    );
    return;
  }

  const start = Date.now();
  let totalCost = 0;
  let totalWarnings = 0;
  let okCount = 0;
  let failCount = 0;
  let doneCount = 0;
  const failures: { id: string; err: string }[] = [];

  // ワーカープール: concurrency 個のワーカーが共有キューから順次取り出す
  let nextIdx = 0;
  const total = targets.length;
  const workers = Array.from({ length: Math.min(args.concurrency, total) }, async (_, workerId) => {
    while (true) {
      const i = nextIdx++;
      if (i >= total) return;
      const t = targets[i];
      const tStart = Date.now();
      const r = await regenOne(t.id, backupDir, args.dry);
      const tElapsed = Date.now() - tStart;
      totalCost += r.cost_usd;
      totalWarnings += r.warnings.length;
      if (r.ok) okCount++;
      else {
        failCount++;
        failures.push({ id: t.id, err: r.err ?? "unknown" });
      }
      doneCount++;

      // 完了行を出力（順序は完了順）
      const status = r.ok ? "✓" : "✗";
      const warnLabel = r.warnings.length ? `  ⚠×${r.warnings.length}` : "";
      const elapsed = Date.now() - start;
      const avg = elapsed / doneCount;
      const remaining = avg * (total - doneCount) / args.concurrency;
      console.log(
        `  ${status} [${doneCount.toString().padStart(3)}/${total}] w${workerId} ${fmtSec(tElapsed).padStart(7)}  $${r.cost_usd.toFixed(4)}${warnLabel}  cost=$${totalCost.toFixed(3)} eta=${fmtSec(remaining)}  ${t.title.slice(0, 48)}`
      );
      if (!r.ok) console.log(`     err: ${r.err}`);
      if (r.warnings.length > 0) {
        r.warnings.slice(0, 3).forEach((w) => console.log(`     ${w}`));
      }
    }
  });
  await Promise.all(workers);

  console.log(`\n${"=".repeat(78)}`);
  console.log(`  Done in ${fmtSec(Date.now() - start)}`);
  console.log(`  Articles:  ${targets.length} (ok=${okCount}, fail=${failCount})`);
  console.log(`  Cost:      $${totalCost.toFixed(4)}`);
  console.log(`  Warnings:  ${totalWarnings}`);
  console.log(`  Backups:   ${backupDir}`);
  if (failures.length > 0) {
    console.log(`  Failures:`);
    failures.forEach((f) => console.log(`    - ${f.id}: ${f.err}`));
  }
}

main().catch((e) => {
  console.error("\nfatal:", e);
  process.exit(1);
});
