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
  } else if (result.remainingPending > 0 && !result.paused) {
    // 予算切れだがまだ pending が残っている場合、自分自身を再ディスパッチして
    // 次の 5h 枠で続行する。PAT が無ければスキップ（30 分後の cron が拾う）。
    await selfRedispatch(args.jobId, args.maxMinutes, args.concurrency);
  }
}

/**
 * GitHub REST API で articles-agent.yml を再起動する。
 * GH_AGENT_DISPATCH_TOKEN が無ければ何もしない（cron が後で拾う）。
 *
 * 通常の workflow_dispatch では実行中の workflow から自分自身を起動する制限が
 * 緩い（実行中グループ articles-agent-<jobId> がキューに新ランを積む）ので、
 * このまま 5h 切れ直後にトリガーしても OK。
 */
async function selfRedispatch(
  jobId: string,
  maxMinutes: number,
  concurrency: number
): Promise<void> {
  const token = process.env.GH_AGENT_DISPATCH_TOKEN;
  if (!token) {
    console.log(
      "[drain-job] self-redispatch skipped: GH_AGENT_DISPATCH_TOKEN not set"
    );
    return;
  }
  const repo =
    process.env.GITHUB_REPOSITORY ??
    (process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME
      ? `${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}`
      : null);
  if (!repo) {
    console.warn("[drain-job] self-redispatch: repo info not resolvable");
    return;
  }
  const ref = process.env.GH_AGENT_DISPATCH_REF ?? "main";
  const url = `https://api.github.com/repos/${repo}/actions/workflows/articles-agent.yml/dispatches`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref,
        inputs: {
          job_id: jobId,
          max_minutes: String(maxMinutes),
          concurrency: String(concurrency),
        },
      }),
    });
    if (res.status === 204) {
      console.log(`[drain-job] self-redispatch ok (jobId=${jobId})`);
    } else {
      const body = await res.text().catch(() => "");
      console.warn(
        `[drain-job] self-redispatch failed: ${res.status} ${body.slice(0, 200)}`
      );
    }
  } catch (e) {
    console.warn(
      `[drain-job] self-redispatch error: ${(e as Error).message}`
    );
  }
}

main()
  .catch((e) => {
    console.error("[drain-job] fatal:", e);
    process.exit(1);
  })
  .then(() => process.exit(0));
