/**
 * 1 社だけで processTask を直接叩くスモークテスト。
 *
 * 使い方:
 *   npx tsx scripts/articles/agent/smoke-test.ts                 # 自動で 1 社選ぶ
 *   npx tsx scripts/articles/agent/smoke-test.ts --edinet=E02144  # 指定企業
 *   npx tsx scripts/articles/agent/smoke-test.ts --dry-run        # 判定だけして処理しない
 */

import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { processTask } from "@/lib/articles/agent/process-company";
import {
  decideSkipOrRewrite,
  findExistingSalaryArticleForCompany,
  loadLatestYuhoForCompanies,
} from "@/lib/admin/articles/agent/skip-rewrite";

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

function parseArgs(argv: string[]): { edinet: string | null; dry: boolean } {
  const map: Record<string, string> = {};
  let dry = false;
  for (const a of argv) {
    if (a === "--dry-run") dry = true;
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) map[m[1]] = m[2];
  }
  return { edinet: map.edinet ?? null, dry };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  envOrThrow("OPENAI_API_KEY");
  const sb = createClient(
    envOrThrow("NEXT_PUBLIC_SUPABASE_URL"),
    envOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

  // 1) 対象企業を決定
  let companyId: string;
  let companyName: string;
  let edinet: string;
  if (args.edinet) {
    const r = await sb
      .from("companies")
      .select("id, name, edinet_code")
      .eq("edinet_code", args.edinet)
      .maybeSingle();
    if (r.error || !r.data) {
      throw new Error(`company not found: ${args.edinet}`);
    }
    companyId = (r.data as { id: string }).id;
    companyName = (r.data as { name: string }).name;
    edinet = (r.data as { edinet_code: string }).edinet_code;
  } else {
    // 自動選択：直近で有報を出している企業から 1 社（既に salary 記事がある企業を優先して
    //          「skip パスのスモーク」になるようにする）
    const fm = await sb
      .from("financial_metrics")
      .select("company_id, submitted_at")
      .not("doc_id", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(1);
    if (fm.error || !fm.data?.[0]) throw new Error("no financial_metrics");
    companyId = (fm.data[0] as { company_id: string }).company_id;
    const c = await sb
      .from("companies")
      .select("name, edinet_code")
      .eq("id", companyId)
      .single();
    companyName = (c.data as { name: string }).name;
    edinet = (c.data as { edinet_code: string }).edinet_code;
  }

  console.log(`[smoke] target: ${companyName} (${edinet}) id=${companyId}`);

  // 2) 判定をプレビュー（処理前に状況を見せる）
  const latestMap = await loadLatestYuhoForCompanies(sb, [companyId]);
  const latest = latestMap.get(companyId);
  const existing = await findExistingSalaryArticleForCompany(sb, companyId);
  console.log(
    `[smoke] latest yuho: ${
      latest
        ? `doc_id=${latest.doc_id} fy=${latest.fiscal_year} submitted=${latest.submitted_at}`
        : "(なし)"
    }`
  );
  console.log(
    `[smoke] existing salary article: ${
      existing
        ? `id=${existing.article_id} doc_id=${existing.article_doc_id} submitted=${existing.article_yuho_submitted}`
        : "(なし)"
    }`
  );
  const decision = decideSkipOrRewrite({
    latest,
    existing,
    rewriteIfNewerYuho: true,
    skipExisting: false,
  });
  console.log(`[smoke] decision: ${JSON.stringify(decision)}`);

  if (args.dry) {
    console.log("[smoke] --dry-run なのでここで終了");
    return;
  }

  // 3) 一時的なジョブ + タスク行を作って processTask に渡す
  const jobIns = await sb
    .from("agent_jobs")
    .insert({
      template_id: "salary",
      status: "running",
      selection_mode: "individual",
      selection_payload: {
        mode: "individual",
        companyIds: [companyId],
      } as object,
      options: {
        skipExisting: false,
        rewriteIfNewerYuho: true,
        model: "gpt-4o-mini",
        concurrency: 1,
        costCapUsd: null,
      } as object,
      total_tasks: 1,
      pending_count: 1,
      notes: "smoke-test",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (jobIns.error || !jobIns.data) throw new Error(`job: ${jobIns.error?.message}`);
  const jobId = (jobIns.data as { id: string }).id;
  console.log(`[smoke] job id=${jobId}`);

  const taskIns = await sb
    .from("agent_job_tasks")
    .insert({
      job_id: jobId,
      sequence: 0,
      company_id: companyId,
      status: "running",
      target_doc_id: latest?.doc_id ?? null,
      target_fiscal_year: latest?.fiscal_year ?? null,
      target_submitted_at: latest?.submitted_at ?? null,
      sections_total: 15,
      attempts: 1,
      started_at: new Date().toISOString(),
      locked_by: "smoke-test",
      locked_until: new Date(Date.now() + 15 * 60_000).toISOString(),
    })
    .select("id")
    .single();
  if (taskIns.error || !taskIns.data) throw new Error(`task: ${taskIns.error?.message}`);
  const taskId = (taskIns.data as { id: string }).id;
  console.log(`[smoke] task id=${taskId}`);

  // 4) processTask を実行（generators がブラウザ向けの "use server" を含むが、
  //    既存 CLI と同じパスなので tsx で動く想定）
  console.log(`[smoke] processTask 実行中…（最大 90 秒）`);
  const t0 = Date.now();
  const outcome = await processTask(
    // 型互換のため as any 経由で渡す（@supabase/supabase-js の v2 の型は同一）
    sb as unknown as Parameters<typeof processTask>[0],
    {
      id: taskId,
      job_id: jobId,
      company_id: companyId,
      article_id: null,
    },
    {
      rewriteIfNewerYuho: true,
      skipExisting: false,
      model: "gpt-4o-mini",
    }
  );
  const ms = Date.now() - t0;
  console.log(`[smoke] outcome (${ms}ms):`, JSON.stringify(outcome, null, 2));

  // 5) タスク行を最終化（drain-job がやることのスモークテスト版）
  const now = new Date().toISOString();
  if (outcome.kind === "succeeded") {
    await sb
      .from("agent_job_tasks")
      .update({
        status: "succeeded",
        finished_at: now,
        article_id: outcome.article_id,
        was_rewrite: outcome.was_rewrite,
        cost_usd: outcome.cost_usd,
      })
      .eq("id", taskId);
    await sb
      .from("agent_jobs")
      .update({
        status: "completed",
        finished_at: now,
        succeeded_count: 1,
        pending_count: 0,
        total_cost_usd: outcome.cost_usd,
      })
      .eq("id", jobId);
  } else if (outcome.kind === "skipped") {
    await sb
      .from("agent_job_tasks")
      .update({
        status: "skipped",
        finished_at: now,
        skip_reason: outcome.reason,
        article_id: outcome.article_id,
      })
      .eq("id", taskId);
    await sb
      .from("agent_jobs")
      .update({
        status: "completed",
        finished_at: now,
        skipped_count: 1,
        pending_count: 0,
      })
      .eq("id", jobId);
  } else {
    await sb
      .from("agent_job_tasks")
      .update({
        status: outcome.kind,
        finished_at: now,
        article_id:
          "article_id" in outcome ? (outcome as { article_id: string | null }).article_id : null,
        cost_usd: outcome.cost_usd,
        error_code:
          "error_code" in outcome ? outcome.error_code : null,
        error_message:
          "error_message" in outcome ? outcome.error_message : null,
      })
      .eq("id", taskId);
    await sb
      .from("agent_jobs")
      .update({
        status: "completed_with_errors",
        finished_at: now,
        failed_count: outcome.kind === "failed" ? 1 : 0,
        cancelled_count: outcome.kind === "cancelled" ? 1 : 0,
        pending_count: 0,
      })
      .eq("id", jobId);
  }

  console.log(`[smoke] 完了。ジョブ確認: /admin/articles/agent/${jobId}`);
}

main().catch((e) => {
  console.error("[smoke] FAIL:", e);
  process.exit(1);
});
