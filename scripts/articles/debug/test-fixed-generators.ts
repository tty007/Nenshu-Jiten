/**
 * 修正後の生成器を実 OpenAI で走らせて、ハルシネーション NG パターンが
 * 解消されているかを検証する。
 *
 * 使い方:
 *   npx tsx scripts/articles/test-fixed-generators.ts             # 直近 draft 3 件
 *   npx tsx scripts/articles/test-fixed-generators.ts --n=5
 *   npx tsx scripts/articles/test-fixed-generators.ts --articleId=<uuid>
 *
 * 注意: 実 API を叩くので OpenAI 課金が発生する（記事 1 件で約 $0.0035）。
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
import {
  loadSalaryArticleContext,
} from "../../lib/admin/articles/salary-template/data";
import {
  generateSection,
  detectHallucinations,
} from "../../lib/admin/articles/salary-template/generators";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type Args = { articleId: string | null; n: number };
function parseArgs(): Args {
  const a = process.argv.slice(2);
  let articleId: string | null = null;
  let n = 3;
  for (const v of a) {
    if (v.startsWith("--articleId=")) articleId = v.slice("--articleId=".length);
    else if (v.startsWith("--n=")) n = Number(v.slice("--n=".length));
  }
  return { articleId, n };
}

const SECTIONS_TO_TEST = ["4.3", "4.8", "4.11", "4.12"]; // 影響セクションのみ

async function pickArticles(args: Args): Promise<string[]> {
  if (args.articleId) return [args.articleId];
  const { data, error } = await sb
    .from("articles")
    .select("id, body_html")
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return ((data ?? []) as { id: string; body_html: string }[])
    .filter((r) => (r.body_html ?? "").length > 5000)
    .slice(0, args.n)
    .map((r) => r.id);
}

async function main() {
  const args = parseArgs();
  const ids = await pickArticles(args);
  console.log(`Testing ${ids.length} article(s) × ${SECTIONS_TO_TEST.length} sections`);

  const aggregateWarnings: Record<string, number> = {};
  let totalCost = 0;
  let totalWarnings = 0;

  for (let i = 0; i < ids.length; i++) {
    const articleId = ids[i];
    const ctxRes = await loadSalaryArticleContext(articleId);
    if (!ctxRes.ok) {
      console.log(`\n[${i + 1}/${ids.length}] ${articleId} -- LOAD FAILED: ${ctxRes.error}`);
      continue;
    }
    const ctx = ctxRes.data;
    console.log(
      `\n${"=".repeat(78)}\n[${i + 1}/${ids.length}] ${ctx.company.name} (${articleId})\n${"=".repeat(78)}`
    );

    for (const sectionId of SECTIONS_TO_TEST) {
      const r = await generateSection({
        sectionId,
        ctx,
        model: "gpt-4o-mini",
      });
      if (!r.ok) {
        console.log(`  §${sectionId}  FAIL: ${r.error}`);
        continue;
      }
      const html = r.data.html;
      const warnings = r.data.warnings ?? [];
      // 出力時点で再走査（detectHallucinations は generators 側で既に走るが、
      // 全文に対して走らせて取りこぼしを確認）
      const allWarnings = detectHallucinations(html, ctx.company.summary ?? "");
      totalCost += r.data.usage.cost_usd;
      console.log(
        `\n  §${sectionId}  cost=$${r.data.usage.cost_usd.toFixed(5)}  len=${html.length}  warnings=${allWarnings.length}`
      );
      if (allWarnings.length > 0) {
        for (const w of allWarnings) {
          console.log(`    ⚠ ${w}`);
          totalWarnings++;
          aggregateWarnings[w.split(" (")[0]] = (aggregateWarnings[w.split(" (")[0]] ?? 0) + 1;
        }
      }
      // 本文をやや簡略にダンプ（最初の 800 文字）
      const preview = html.replace(/\s+/g, " ").slice(0, 800);
      console.log(`    >>> ${preview}${html.length > 800 ? "..." : ""}`);
    }
  }

  console.log(`\n${"=".repeat(78)}\n  AGGREGATE\n${"=".repeat(78)}`);
  console.log(`  Articles: ${ids.length}, sections per article: ${SECTIONS_TO_TEST.length}`);
  console.log(`  Total OpenAI cost: $${totalCost.toFixed(4)}`);
  console.log(`  Total warnings: ${totalWarnings}`);
  if (Object.keys(aggregateWarnings).length === 0) {
    console.log(`  ✅ No NG patterns detected.`);
  } else {
    console.log(`  Warning breakdown:`);
    for (const [k, v] of Object.entries(aggregateWarnings)) {
      console.log(`    ${k}: ${v}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
