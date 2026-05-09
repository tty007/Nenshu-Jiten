/**
 * 指定された agent_jobs.id を 1 件ドレインする CLI。
 * GitHub Actions workflow_dispatch (job_id 指定) から呼ばれる。
 *
 * 使い方:
 *   npx tsx scripts/articles/agent/drain-job.ts \
 *     --jobId=<uuid> [--maxMinutes=300] [--concurrency=1]
 *
 * 自動ピックアップ版は scripts/articles/agent/auto-drain.ts を使う。
 */

import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import {
  drainUntilBudgetOut,
  releaseExpiredLeases,
  runDrainJob,
} from "@/lib/articles/agent/drain-runner";

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

function clampInt(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

function parseArgs(argv: string[]) {
  const map: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) map[m[1]] = m[2];
  }
  const jobId = map.jobId ?? process.env.AGENT_JOB_ID ?? "";
  if (!jobId)
    throw new Error("--jobId=<uuid> または AGENT_JOB_ID 環境変数が必要です");
  return {
    jobId,
    maxMinutes: clampInt(
      Number(map.maxMinutes ?? process.env.AGENT_MAX_MINUTES ?? "300"),
      5,
      350
    ),
    concurrency: clampInt(
      Number(map.concurrency ?? process.env.AGENT_CONCURRENCY ?? "1"),
      1,
      3
    ),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  envOrThrow("OPENAI_API_KEY");
  const sb = createClient(
    envOrThrow("NEXT_PUBLIC_SUPABASE_URL"),
    envOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
  const runId = process.env.GH_RUN_ID ?? `local-${Date.now().toString(36)}`;

  console.log(
    `[drain-job] jobId=${args.jobId} maxMinutes=${args.maxMinutes} concurrency=${args.concurrency} run=${runId}`
  );

  // クラッシュした worker のリースが残っているなら先に解放する
  try {
    const released = await releaseExpiredLeases(sb);
    if (released > 0) {
      console.log(`[drain-job] released ${released} expired leases`);
    }
  } catch (e) {
    console.warn(`[drain-job] release leases: ${(e as Error).message}`);
  }

  const startMs = Date.now();
  const result = await runDrainJob({
    sb,
    jobId: args.jobId,
    maxMinutes: args.maxMinutes,
    concurrency: args.concurrency,
    runId,
  });
  console.log(`[drain-job] done`, JSON.stringify(result));

  // 直列ポリシー：このジョブが完了し、まだ予算に余裕があれば、
  // 次に queued になっているジョブを継続して処理する。
  if (result.finalized) {
    const elapsedMin = (Date.now() - startMs) / 60_000;
    const remainingMin = Math.floor(args.maxMinutes - elapsedMin);
    if (remainingMin >= 5) {
      const chained = await drainUntilBudgetOut(sb, {
        maxMinutes: remainingMin,
        concurrency: args.concurrency,
        runId,
      });
      if (chained.jobs > 0) {
        console.log(
          `[drain-job] chained ${chained.jobs} more job(s) within remaining budget`
        );
      }
    }
  }
}

main()
  .catch((e) => {
    console.error("[drain-job] fatal:", e);
    process.exit(1);
  })
  .then(() => process.exit(0));
