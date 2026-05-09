// drain ロジックを CLI 間で共有するためのコアランナー。
// scripts/articles/agent/drain-job.ts (jobId 指定) と auto-drain.ts (cron 自動ピックアップ) の両方から呼ばれる。

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  processTask,
  type ProcessTaskOutcome,
} from "./process-company";
import type { AgentJobOptions } from "@/lib/admin/articles/agent/types";

export type DrainResult = {
  jobId: string;
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
  cancelled: number;
  /** ループ後にジョブが完了確定したか */
  finalized: boolean;
  /** ポーズ要求で抜けたか（status を 'paused' に倒した） */
  paused: boolean;
  /** まだ pending タスクが残っているか（次回の cron / 再ディスパッチで処理される） */
  remainingPending: number;
};

type ClaimedTask = {
  id: string;
  job_id: string;
  sequence: number;
  company_id: string;
  status: string;
  target_doc_id: string | null;
  target_fiscal_year: number | null;
  target_submitted_at: string | null;
  article_id: string | null;
  attempts: number;
  max_attempts: number;
};

type JobRow = {
  id: string;
  status: string;
  options: AgentJobOptions;
  cancel_requested: boolean;
  pause_requested: boolean;
  total_cost_usd: number;
  pending_count: number;
  running_count: number;
  succeeded_count: number;
  skipped_count: number;
  failed_count: number;
  cancelled_count: number;
};

export type DrainJobInput = {
  sb: SupabaseClient;
  jobId: string;
  /** ソフト上限（分）。GitHub Actions の 6h 上限に対し、5h を推奨値 */
  maxMinutes: number;
  /** 1〜3 の並列度 */
  concurrency: number;
  /** ログ用途のランナー識別子（locked_by に書く） */
  runId: string;
  /** 進捗ログを stdout に出すか */
  verbose?: boolean;
};

/**
 * 1 ジョブをドレインする。
 * - ジョブを running に
 * - ハートビートを 30 秒おきに更新
 * - claim_next_task でタスクを取り続けて processTask 実行
 * - キャンセル要求 / コスト上限 / 予算切れを尊重
 * - 終了時にジョブを完了確定 or pending を残してリターン
 */
export async function runDrainJob(
  input: DrainJobInput
): Promise<DrainResult> {
  const { sb, jobId, maxMinutes, concurrency, runId } = input;
  const log = (msg: string) => {
    if (input.verbose !== false) console.log(`[drain] ${msg}`);
  };

  // ジョブを running に
  const job0 = await loadJob(sb, jobId);
  if (
    job0.status === "completed" ||
    job0.status === "cancelled" ||
    job0.status === "failed"
  ) {
    log(`job is ${job0.status}, exit`);
    return baseResult(jobId);
  }
  await sb
    .from("agent_jobs")
    .update({
      status: "running",
      started_at:
        job0.status === "queued" ? new Date().toISOString() : undefined,
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  const stopHeartbeat = startHeartbeat(sb, jobId);

  const startedAtMs = Date.now();
  const deadlineMs = startedAtMs + maxMinutes * 60_000 - 90_000;
  const opts = job0.options;

  let processed = 0;
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;
  let cancelled = 0;

  await runWithConcurrency(
    concurrency,
    () => Date.now() > deadlineMs,
    async () => {
      // コスト上限
      if (opts.costCapUsd != null) {
        const cur = await loadJob(sb, jobId);
        if (cur.total_cost_usd >= opts.costCapUsd) {
          log(
            `cost cap reached: total=${cur.total_cost_usd.toFixed(4)} cap=${opts.costCapUsd}`
          );
          await sb
            .from("agent_job_tasks")
            .update({
              status: "cancelled",
              skip_reason: "cost_cap_reached",
              finished_at: new Date().toISOString(),
            })
            .eq("job_id", jobId)
            .eq("status", "pending");
          return "empty";
        }
      }

      // ポーズ要求が来ていたら、新しいタスクを取らずにループ離脱
      // （実行中のタスクがあればこの workOnce は呼ばれていない時点ではないので、
      //   実態としては「このタスク取得前に止まる」になる）
      if (await isPauseRequested(sb, jobId)) {
        return "empty";
      }

      const task = await claimNextTask(sb, jobId, runId);
      if (!task) return "empty";

      // キャンセル要求
      if (await isCancelRequested(sb, jobId)) {
        await finalizeTask(sb, jobId, task, {
          kind: "cancelled",
          article_id: task.article_id,
          cost_usd: 0,
        });
        cancelled++;
        processed++;
        return "got";
      }

      const t0 = Date.now();
      const outcome = await processTask(
        sb,
        {
          id: task.id,
          job_id: task.job_id,
          company_id: task.company_id,
          article_id: task.article_id,
        },
        {
          rewriteIfNewerYuho: opts.rewriteIfNewerYuho,
          skipExisting: opts.skipExisting,
          model: opts.model,
          isCancelRequested: () => isCancelRequested(sb, jobId),
        }
      );
      const ms = Date.now() - t0;

      const tag =
        outcome.kind === "succeeded"
          ? `OK${outcome.was_rewrite ? "(R)" : ""}`
          : outcome.kind === "skipped"
          ? `SKIP(${outcome.reason})`
          : outcome.kind === "cancelled"
          ? "CANCELLED"
          : `FAIL(${outcome.error_code})`;
      log(
        `task#${task.sequence + 1} ${tag} ${ms}ms cost=$${outcome.cost_usd.toFixed(4)}`
      );

      await finalizeTask(sb, jobId, task, outcome);
      processed++;
      if (outcome.kind === "succeeded") succeeded++;
      else if (outcome.kind === "skipped") skipped++;
      else if (outcome.kind === "failed") failed++;
      else if (outcome.kind === "cancelled") cancelled++;

      return "got";
    }
  );

  log(
    `processed=${processed} ok=${succeeded} skip=${skipped} fail=${failed} elapsed=${Math.round(
      (Date.now() - startedAtMs) / 1000
    )}s`
  );

  // 終端判定
  let cur = await loadJob(sb, jobId);
  let finalized = false;
  let paused = false;

  if (cur.pause_requested && !cur.cancel_requested) {
    // ポーズ路：status を 'paused' に倒す。タスク状態はそのまま（pending のまま）。
    await sb
      .from("agent_jobs")
      .update({
        status: "paused",
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    paused = true;
  } else {
    finalized = await finalizeJobIfDone(sb, jobId);
    cur = await loadJob(sb, jobId);
    if (!finalized && cur.cancel_requested) {
      await sb
        .from("agent_job_tasks")
        .update({
          status: "cancelled",
          finished_at: new Date().toISOString(),
        })
        .eq("job_id", jobId)
        .eq("status", "pending");
      finalized = await finalizeJobIfDone(sb, jobId);
      cur = await loadJob(sb, jobId);
    }
  }

  stopHeartbeat();

  return {
    jobId,
    processed,
    succeeded,
    skipped,
    failed,
    cancelled,
    finalized,
    paused,
    remainingPending: cur.pending_count,
  };
}

// =====================================================================
// 共通ヘルパー
// =====================================================================

/**
 * 「いま生きている（= 別 worker が処理中の）」ジョブがあるか判定する。
 * status='running' かつ last_heartbeat_at が freshMinutes 以内であるもの。
 *
 * ジョブの直列実行ポリシー（同時に 1 ジョブのみ処理）を
 * 強制するために、ドレイン起動前にこれをチェックする。
 */
export async function isAnotherJobActive(
  sb: SupabaseClient,
  excludeJobId?: string,
  freshMinutes = 5
): Promise<boolean> {
  const cutoff = new Date(Date.now() - freshMinutes * 60_000).toISOString();
  let q = sb
    .from("agent_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "running")
    .gte("last_heartbeat_at", cutoff);
  if (excludeJobId) q = q.neq("id", excludeJobId);
  const r = await q;
  if (r.error) {
    console.warn(`[isAnotherJobActive] ${r.error.message}`);
    return false;
  }
  return (r.count ?? 0) > 0;
}

/**
 * 予算（maxMinutes）内で「次に着手すべきジョブ」を順次取得して連続的にドレインする。
 * 直列実行（一度に 1 ジョブだけ）を保ったまま、ジョブ完了→次のジョブ開始の
 * 隙間を最小化する（cron 待ちのギャップを潰す）。
 */
export async function drainUntilBudgetOut(
  sb: SupabaseClient,
  options: {
    maxMinutes: number;
    concurrency: number;
    runId: string;
    verbose?: boolean;
  }
): Promise<{ jobs: number; lastResult: DrainResult | null }> {
  const startMs = Date.now();
  const deadlineMs = startMs + options.maxMinutes * 60_000 - 90_000;
  let jobs = 0;
  let lastResult: DrainResult | null = null;

  while (Date.now() < deadlineMs) {
    const jobId = await findNextClaimableJobId(sb);
    if (!jobId) break;
    const remainingMs = deadlineMs - Date.now();
    if (remainingMs < 30_000) break; // 残り 30 秒未満ならスキップ
    const remainingMin = Math.max(1, Math.floor(remainingMs / 60_000));
    lastResult = await runDrainJob({
      sb,
      jobId,
      maxMinutes: remainingMin,
      concurrency: options.concurrency,
      runId: options.runId,
      verbose: options.verbose,
    });
    jobs++;
    // ポーズで離脱した時は、次の queued ジョブに移る（chain 継続）。
    if (lastResult.paused) continue;
    // 完了せず、ポーズでもない = 予算切れ。次のジョブに進まずに抜ける。
    if (!lastResult.finalized) break;
  }
  return { jobs, lastResult };
}

/**
 * 「次に着手すべきジョブ」を 1 件返す。
 * - queued の最古
 * - running で last_heartbeat_at が >10 分経過しているもの（孤児）
 * 該当なしなら null。
 */
export async function findNextClaimableJobId(
  sb: SupabaseClient,
  staleHeartbeatMinutes = 10
): Promise<string | null> {
  // queued から最古を取る
  const q = await sb
    .from("agent_jobs")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (q.error) throw new Error(`findNextClaimableJobId queued: ${q.error.message}`);
  if (q.data) return (q.data as { id: string }).id;

  // running で heartbeat 切れを孤児として拾う
  const cutoff = new Date(
    Date.now() - staleHeartbeatMinutes * 60_000
  ).toISOString();
  const stale = await sb
    .from("agent_jobs")
    .select("id, last_heartbeat_at")
    .eq("status", "running")
    .or(`last_heartbeat_at.is.null,last_heartbeat_at.lt.${cutoff}`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (stale.error) throw new Error(`findNextClaimableJobId running: ${stale.error.message}`);
  return stale.data ? (stale.data as { id: string }).id : null;
}

/**
 * 期限切れの running タスクリースを pending に戻す。
 * リース時間内にハートビートが届かなければ、別ワーカーが奪取できるようにする。
 */
export async function releaseExpiredLeases(
  sb: SupabaseClient
): Promise<number> {
  const r = await sb
    .from("agent_job_tasks")
    .update({
      status: "pending",
      locked_by: null,
      locked_until: null,
    })
    .eq("status", "running")
    .lt("locked_until", new Date().toISOString())
    .select("id");
  if (r.error) throw new Error(`releaseExpiredLeases: ${r.error.message}`);
  return r.data?.length ?? 0;
}

function baseResult(jobId: string): DrainResult {
  return {
    jobId,
    processed: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    cancelled: 0,
    finalized: false,
    paused: false,
    remainingPending: 0,
  };
}

function startHeartbeat(sb: SupabaseClient, jobId: string): () => void {
  const tick = async () => {
    await sb
      .from("agent_jobs")
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq("id", jobId);
  };
  void tick();
  const id = setInterval(() => void tick(), 30_000);
  return () => clearInterval(id);
}

async function claimNextTask(
  sb: SupabaseClient,
  jobId: string,
  runId: string
): Promise<ClaimedTask | null> {
  const r = await sb.rpc("claim_next_task", {
    p_job_id: jobId,
    p_lock_owner: runId,
    p_lease_seconds: 900,
  });
  if (r.error) throw new Error(`claim_next_task: ${r.error.message}`);
  const rows = (r.data ?? []) as ClaimedTask[];
  return rows.length > 0 ? rows[0] : null;
}

async function loadJob(
  sb: SupabaseClient,
  jobId: string
): Promise<JobRow> {
  const r = await sb
    .from("agent_jobs")
    .select(
      "id, status, options, cancel_requested, pause_requested, total_cost_usd, pending_count, running_count, succeeded_count, skipped_count, failed_count, cancelled_count"
    )
    .eq("id", jobId)
    .single();
  if (r.error) throw new Error(`loadJob: ${r.error.message}`);
  return r.data as JobRow;
}

async function isCancelRequested(
  sb: SupabaseClient,
  jobId: string
): Promise<boolean> {
  const r = await sb
    .from("agent_jobs")
    .select("cancel_requested")
    .eq("id", jobId)
    .maybeSingle();
  return Boolean(
    (r.data as { cancel_requested: boolean } | null)?.cancel_requested
  );
}

async function isPauseRequested(
  sb: SupabaseClient,
  jobId: string
): Promise<boolean> {
  const r = await sb
    .from("agent_jobs")
    .select("pause_requested")
    .eq("id", jobId)
    .maybeSingle();
  return Boolean(
    (r.data as { pause_requested: boolean } | null)?.pause_requested
  );
}

async function finalizeTask(
  sb: SupabaseClient,
  jobId: string,
  task: ClaimedTask,
  outcome: ProcessTaskOutcome
): Promise<void> {
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
        locked_by: null,
        locked_until: null,
        error_code: null,
        error_message: null,
      })
      .eq("id", task.id);
  } else if (outcome.kind === "skipped") {
    await sb
      .from("agent_job_tasks")
      .update({
        status: "skipped",
        finished_at: now,
        skip_reason: outcome.reason,
        article_id: outcome.article_id,
        cost_usd: outcome.cost_usd,
        locked_by: null,
        locked_until: null,
      })
      .eq("id", task.id);
  } else if (outcome.kind === "cancelled") {
    await sb
      .from("agent_job_tasks")
      .update({
        status: "cancelled",
        finished_at: now,
        article_id: outcome.article_id,
        cost_usd: outcome.cost_usd,
        locked_by: null,
        locked_until: null,
      })
      .eq("id", task.id);
  } else {
    const reachedMax = task.attempts >= task.max_attempts;
    if (reachedMax) {
      await sb
        .from("agent_job_tasks")
        .update({
          status: "failed",
          finished_at: now,
          article_id: outcome.article_id,
          cost_usd: outcome.cost_usd,
          error_code: outcome.error_code,
          error_message: outcome.error_message.slice(0, 1000),
          locked_by: null,
          locked_until: null,
        })
        .eq("id", task.id);
    } else {
      await sb
        .from("agent_job_tasks")
        .update({
          status: "pending",
          article_id: outcome.article_id,
          cost_usd: outcome.cost_usd,
          error_code: outcome.error_code,
          error_message: outcome.error_message.slice(0, 1000),
          locked_by: null,
          locked_until: null,
        })
        .eq("id", task.id);
    }
  }

  // agent_jobs カウンタ補正
  const cur = await loadJob(sb, jobId);
  const upd: Record<string, unknown> = {
    last_heartbeat_at: now,
    total_cost_usd: cur.total_cost_usd + outcome.cost_usd,
  };
  if (outcome.kind === "succeeded") {
    upd.pending_count = Math.max(0, cur.pending_count - 1);
    upd.succeeded_count = cur.succeeded_count + 1;
  } else if (outcome.kind === "skipped") {
    upd.pending_count = Math.max(0, cur.pending_count - 1);
    upd.skipped_count = cur.skipped_count + 1;
  } else if (outcome.kind === "cancelled") {
    upd.pending_count = Math.max(0, cur.pending_count - 1);
    upd.cancelled_count = cur.cancelled_count + 1;
  } else {
    const reachedMax = task.attempts >= task.max_attempts;
    if (reachedMax) {
      upd.pending_count = Math.max(0, cur.pending_count - 1);
      upd.failed_count = cur.failed_count + 1;
    }
  }
  await sb.from("agent_jobs").update(upd).eq("id", jobId);
}

async function finalizeJobIfDone(
  sb: SupabaseClient,
  jobId: string
): Promise<boolean> {
  const job = await loadJob(sb, jobId);
  const remaining = job.pending_count + job.running_count;
  if (remaining > 0) return false;

  let nextStatus: JobRow["status"];
  if (job.cancel_requested) nextStatus = "cancelled";
  else if (job.failed_count > 0) nextStatus = "completed_with_errors";
  else nextStatus = "completed";

  await sb
    .from("agent_jobs")
    .update({
      status: nextStatus,
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  return true;
}

async function runWithConcurrency(
  concurrency: number,
  shouldStop: () => boolean,
  workOnce: () => Promise<"got" | "empty">
): Promise<void> {
  let stop = false;
  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (!stop) {
          if (shouldStop()) {
            stop = true;
            break;
          }
          const r = await workOnce();
          if (r === "empty") {
            stop = true;
            break;
          }
        }
      })()
    );
  }
  await Promise.all(workers);
}
