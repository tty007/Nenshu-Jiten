"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";
import { getCurrentUser } from "@/lib/auth/get-user";
import {
  drainUntilBudgetOut,
  isAnotherJobActive,
  runDrainJob,
} from "@/lib/articles/agent/drain-runner";
import { triggerNextChain } from "@/lib/articles/agent/chain";
import {
  computeJobScopePreview,
  listAgentJobs as listAgentJobsRead,
  listAgentJobTasks as listAgentJobTasksRead,
  getAgentJobDetail as getAgentJobDetailRead,
  resolveCompaniesByFreshness,
  resolveCompaniesByIds,
  normalizeAgentJobOptions,
  type ResolvedTargetCompany,
} from "./data";
import {
  decideSkipOrRewrite,
  findExistingSalaryArticlesBulk,
  loadLatestYuhoForCompanies,
} from "./skip-rewrite";
import type {
  AgentFreshness,
  AgentJobOptions,
  AgentJobRow,
  AgentJobScopePreview,
  AgentSelectionMode,
  AgentSelectionPayload,
  AgentTaskRow,
} from "./types";
import { dispatchAgentWorker } from "./dispatch";
import { SALARY_SECTIONS } from "@/lib/admin/articles/salary-template/sections";

type ActionResult<T = void> = T extends void
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string };

async function requireAdmin(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };
  return { ok: true };
}

// =====================================================================
// プレビュー
// =====================================================================

export type PreviewInput = {
  selectionMode: AgentSelectionMode;
  freshness?: AgentFreshness | null;
  monthAnchor?: string | null;
  companyIds?: string[];
  options: Partial<AgentJobOptions>;
};

export async function previewAgentJobScope(
  input: PreviewInput
): Promise<ActionResult<AgentJobScopePreview>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();
  try {
    const data = await computeJobScopePreview({
      sb,
      selectionMode: input.selectionMode,
      freshness: input.freshness ?? null,
      monthAnchor: input.monthAnchor ?? null,
      companyIds: input.companyIds ?? [],
      options: normalizeAgentJobOptions(input.options),
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// =====================================================================
// ジョブ起票
// =====================================================================

export type CreateJobInput = {
  selectionMode: AgentSelectionMode;
  freshness?: AgentFreshness | null;
  monthAnchor?: string | null;
  companyIds?: string[];
  options: Partial<AgentJobOptions>;
  notes?: string | null;
};

export async function createAgentJob(
  input: CreateJobInput
): Promise<ActionResult<{ jobId: string }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const user = await getCurrentUser();
  const sb = createSupabaseAdminClient();
  const options = normalizeAgentJobOptions(input.options);

  // 1) 対象企業の解決
  let companies: ResolvedTargetCompany[];
  try {
    if (input.selectionMode === "all_with_freshness") {
      if (!input.freshness)
        return { ok: false, error: "鮮度フィルタを指定してください" };
      companies = await resolveCompaniesByFreshness(
        sb,
        input.freshness,
        input.monthAnchor ?? null
      );
    } else {
      const ids = input.companyIds ?? [];
      if (ids.length === 0)
        return { ok: false, error: "対象企業を 1 社以上選択してください" };
      if (ids.length > 2000)
        return { ok: false, error: "個別指定は 2000 社までです" };
      companies = await resolveCompaniesByIds(sb, ids);
    }
  } catch (e) {
    return { ok: false, error: `対象企業の解決に失敗: ${(e as Error).message}` };
  }

  if (companies.length === 0) {
    return { ok: false, error: "対象企業が 0 件でした" };
  }

  // 2) 最新有報 + 既存記事を一括取得（skip 判定用）
  const cids = companies.map((c) => c.id);
  let latestMap, existingMap;
  try {
    [latestMap, existingMap] = await Promise.all([
      loadLatestYuhoForCompanies(sb, cids),
      findExistingSalaryArticlesBulk(sb, cids),
    ]);
  } catch (e) {
    return {
      ok: false,
      error: `既存記事の判定に失敗: ${(e as Error).message}`,
    };
  }

  // 3) 起票時の事前削減：skipExisting=true なら same_yuho を除外
  type Candidate = {
    company: ResolvedTargetCompany;
    skip: boolean;
    target_doc_id: string | null;
    target_fiscal_year: number | null;
    target_submitted_at: string | null;
  };
  const candidates: Candidate[] = [];
  for (const c of companies) {
    const latest = latestMap.get(c.id);
    const existing = existingMap.get(c.id);
    const decision = decideSkipOrRewrite({
      latest,
      existing,
      rewriteIfNewerYuho: options.rewriteIfNewerYuho,
      skipExisting: options.skipExisting,
    });
    if (decision.kind === "skip") {
      // 起票時に削減（skipExisting / rewriteIfNewerYuho を反映済の判定）
      continue;
    }
    candidates.push({
      company: c,
      skip: false,
      target_doc_id: latest?.doc_id ?? null,
      target_fiscal_year: latest?.fiscal_year ?? null,
      target_submitted_at: latest?.submitted_at ?? null,
    });
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      error: "対象が全てスキップ条件に当てはまりました。設定を見直してください",
    };
  }

  // 4) selection_payload と agent_jobs INSERT
  const selectionPayload: AgentSelectionPayload =
    input.selectionMode === "all_with_freshness"
      ? {
          mode: "all_with_freshness",
          freshness: input.freshness as AgentFreshness,
          monthAnchor: input.monthAnchor ?? null,
        }
      : {
          mode: "individual",
          companyIds: cids,
        };

  const totalTasks = candidates.length;

  const jobInsert = await sb
    .from("agent_jobs")
    .insert({
      template_id: "salary",
      status: "pending",
      selection_mode: input.selectionMode,
      selection_payload: selectionPayload,
      options,
      total_tasks: totalTasks,
      pending_count: totalTasks,
      notes: (input.notes ?? "").slice(0, 80) || null,
      created_by: user?.id ?? null,
      created_by_email: user?.email ?? null,
    })
    .select("id")
    .single();
  if (jobInsert.error || !jobInsert.data) {
    return {
      ok: false,
      error: `ジョブ作成に失敗: ${jobInsert.error?.message ?? "no data"}`,
    };
  }
  const jobId = (jobInsert.data as { id: string }).id;

  // 5) agent_job_tasks 一括 INSERT
  const taskRows = candidates.map((c, i) => ({
    job_id: jobId,
    sequence: i,
    company_id: c.company.id,
    status: "pending" as const,
    target_doc_id: c.target_doc_id,
    target_fiscal_year: c.target_fiscal_year,
    target_submitted_at: c.target_submitted_at,
    sections_total: SALARY_SECTIONS.length,
  }));

  // PostgREST の payload 上限を考慮し 500 件ごとにチャンク
  const CHUNK = 500;
  for (let i = 0; i < taskRows.length; i += CHUNK) {
    const slice = taskRows.slice(i, i + CHUNK);
    const ins = await sb.from("agent_job_tasks").insert(slice);
    if (ins.error) {
      // ロールバック相当：作ったジョブを消す（cascade で tasks も消える）
      await sb.from("agent_jobs").delete().eq("id", jobId);
      return {
        ok: false,
        error: `タスク投入に失敗: ${ins.error.message}`,
      };
    }
  }

  // 6) ステータスを queued に
  await sb
    .from("agent_jobs")
    .update({ status: "queued" })
    .eq("id", jobId);

  // 7) ドレイン起動：直列ポリシー（同時に 1 ジョブだけ処理）を尊重する。
  //    既に別ジョブが running（heartbeat fresh）なら何も起動しない。
  //    そのジョブが終わった時点で、続行中の runner（drainUntilBudgetOut）が
  //    findNextClaimableJobId 経由でこのジョブに自動で移る。
  //    PAT による GH Actions dispatch も同じ条件で gate する（並列起動を防ぐ）。
  const anotherActive = await isAnotherJobActive(sb, jobId);

  if (!anotherActive) {
    const dispatch = await dispatchAgentWorker({
      jobId,
      maxMinutes: 300,
      concurrency: options.concurrency,
    });
    if (dispatch.ok) {
      await sb
        .from("agent_jobs")
        .update({ last_dispatched_at: new Date().toISOString() })
        .eq("id", jobId);
    } else {
      // PAT が無いだけのケースが大半なので info レベル相当
      console.log(
        `[createAgentJob] dispatch skipped/failed: ${dispatch.error}`
      );
    }
  } else {
    console.log(
      `[createAgentJob] another job is currently active. job=${jobId} stays queued`
    );
  }

  revalidatePath("/admin/articles/agent");

  // 8) 即時実行（Vercel 側）：別ジョブが稼働中でなければ、レスポンス送信後に
  //    最大 4 分間のドレインを走らせる。drainUntilBudgetOut は最古から順に
  //    処理するため、追加した本ジョブだけでなく既存 queued も自然に消化する。
  //    別ジョブが稼働中なら何もせず、cron / その runner の chain mode に任せる。
  after(async () => {
    try {
      const sbAfter = createSupabaseAdminClient();
      if (await isAnotherJobActive(sbAfter, jobId)) {
        console.log(
          "[createAgentJob:after] another job is active, skipping drain"
        );
        return;
      }
      const result = await drainUntilBudgetOut(sbAfter, {
        maxMinutes: 4,
        concurrency: 1,
        runId: `vercel-after-${Date.now().toString(36)}`,
        verbose: false,
      });
      console.log(
        `[createAgentJob:after] drained jobs=${result.jobs} lastFinalized=${result.lastResult?.finalized ?? "n/a"}`
      );
      // 4 分予算で処理しきれず pending が残っているなら、自分自身に
      // チェーンを起動して連続処理を継続する（cron 待ち回避）。
      if (
        result.lastResult &&
        !result.lastResult.finalized &&
        !result.lastResult.paused &&
        result.lastResult.remainingPending > 0
      ) {
        await triggerNextChain({ jobId, depth: 0 });
      }
    } catch (e) {
      console.warn(
        `[createAgentJob:after] drain failed: ${(e as Error).message}`
      );
    }
  });

  return { ok: true, data: { jobId } };
}

// =====================================================================
// 取得（読み取り系のサーバーアクションラッパー）
// =====================================================================

export async function listAgentJobsAction(
  args: { limit?: number } = {}
): Promise<ActionResult<AgentJobRow[]>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  try {
    return { ok: true, data: await listAgentJobsRead(args) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function getAgentJobDetailAction(
  jobId: string
): Promise<
  ActionResult<{ job: AgentJobRow; tasks: AgentTaskRow[] }>
> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  try {
    const job = await getAgentJobDetailRead(jobId);
    if (!job) return { ok: false, error: "ジョブが見つかりません" };
    const tasks = await listAgentJobTasksRead(jobId, { limit: 500 });
    return { ok: true, data: { job, tasks } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// =====================================================================
// 操作系
// =====================================================================

export async function cancelAgentJob(
  jobId: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();

  // pending タスクを cancelled に
  const cancelledRes = await sb
    .from("agent_job_tasks")
    .update({
      status: "cancelled",
      finished_at: new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .eq("status", "pending")
    .select("id");
  if (cancelledRes.error)
    return { ok: false, error: cancelledRes.error.message };
  const cancelledCount = cancelledRes.data?.length ?? 0;

  // running があるか確認
  const running = await sb
    .from("agent_job_tasks")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("status", "running");

  // 進行中タスクが残っていればフラグを立てるだけ。次のチェックポイントで自身が cancelled に。
  // running が 0 なら即 cancelled に確定。
  const upd: Record<string, unknown> = {
    cancel_requested: true,
  };
  if ((running.count ?? 0) === 0) {
    upd.status = "cancelled";
    upd.finished_at = new Date().toISOString();
  }

  // カウンタを補正：pending_count を 0 に、cancelled_count を +cancelledCount
  // 取得して足し算し直す
  const cur = await sb
    .from("agent_jobs")
    .select("pending_count, cancelled_count")
    .eq("id", jobId)
    .maybeSingle();
  if (cur.data) {
    const pending = (cur.data as { pending_count: number }).pending_count ?? 0;
    const already = (cur.data as { cancelled_count: number }).cancelled_count ?? 0;
    upd.pending_count = Math.max(0, pending - cancelledCount);
    upd.cancelled_count = already + cancelledCount;
  }

  const updRes = await sb.from("agent_jobs").update(upd).eq("id", jobId);
  if (updRes.error) return { ok: false, error: updRes.error.message };

  revalidatePath(`/admin/articles/agent`);
  revalidatePath(`/admin/articles/agent/${jobId}`);
  return { ok: true };
}

export async function retryFailedTasks(
  jobId: string
): Promise<ActionResult<{ retried: number }>> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();

  const failed = await sb
    .from("agent_job_tasks")
    .update({
      status: "pending",
      error_code: null,
      error_message: null,
      attempts: 0,
      finished_at: null,
      locked_by: null,
      locked_until: null,
    })
    .eq("job_id", jobId)
    .eq("status", "failed")
    .select("id");
  if (failed.error) return { ok: false, error: failed.error.message };
  const retried = failed.data?.length ?? 0;

  if (retried === 0) {
    return { ok: true, data: { retried: 0 } };
  }

  // カウンタ補正：failed_count -= retried, pending_count += retried
  const cur = await sb
    .from("agent_jobs")
    .select("pending_count, failed_count, cancel_requested")
    .eq("id", jobId)
    .maybeSingle();
  if (cur.data) {
    const c = cur.data as {
      pending_count: number;
      failed_count: number;
      cancel_requested: boolean;
    };
    await sb
      .from("agent_jobs")
      .update({
        status: "queued",
        pending_count: c.pending_count + retried,
        failed_count: Math.max(0, c.failed_count - retried),
        finished_at: null,
        cancel_requested: false,
      })
      .eq("id", jobId);
  }

  // 再ディスパッチ
  const dispatch = await dispatchAgentWorker({ jobId });
  if (dispatch.ok) {
    await sb
      .from("agent_jobs")
      .update({ last_dispatched_at: new Date().toISOString() })
      .eq("id", jobId);
  } else {
    console.warn(
      `[retryFailedTasks] dispatch failed: ${dispatch.error}`
    );
  }

  revalidatePath(`/admin/articles/agent/${jobId}`);
  return { ok: true, data: { retried } };
}

// =====================================================================
// 一時停止 / 再開
// =====================================================================

export async function pauseAgentJob(
  jobId: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();

  const cur = await sb
    .from("agent_jobs")
    .select("id, status")
    .eq("id", jobId)
    .maybeSingle();
  if (cur.error || !cur.data)
    return { ok: false, error: "ジョブが見つかりません" };
  const status = (cur.data as { status: string }).status;
  if (status === "paused") {
    return { ok: false, error: "既に一時停止中です" };
  }
  if (
    status === "completed" ||
    status === "completed_with_errors" ||
    status === "cancelled" ||
    status === "failed"
  ) {
    return { ok: false, error: `${status} のジョブは一時停止できません` };
  }

  // 進行中 (running) はフラグだけ立て、worker がタスク境界で paused に倒す。
  // 待機中 (queued/pending) は即座に paused へ。
  const upd: Record<string, unknown> = { pause_requested: true };
  if (status !== "running") {
    upd.status = "paused";
  }
  const r = await sb.from("agent_jobs").update(upd).eq("id", jobId);
  if (r.error) return { ok: false, error: r.error.message };

  revalidatePath("/admin/articles/agent");
  revalidatePath(`/admin/articles/agent/${jobId}`);
  return { ok: true };
}

export async function resumeAgentJob(
  jobId: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();

  const cur = await sb
    .from("agent_jobs")
    .select("id, status, options")
    .eq("id", jobId)
    .maybeSingle();
  if (cur.error || !cur.data)
    return { ok: false, error: "ジョブが見つかりません" };
  const status = (cur.data as { status: string }).status;
  if (status !== "paused") {
    return { ok: false, error: "paused 状態のジョブだけ再開できます" };
  }

  // queued に戻す。drainer/cron/after() が拾える状態に
  const r = await sb
    .from("agent_jobs")
    .update({
      status: "queued",
      pause_requested: false,
    })
    .eq("id", jobId);
  if (r.error) return { ok: false, error: r.error.message };

  revalidatePath("/admin/articles/agent");
  revalidatePath(`/admin/articles/agent/${jobId}`);

  // 即時再開：他に running が無ければ Vercel 側でドレインを走らせる。
  // 直列ポリシーは drainUntilBudgetOut が遵守する。
  const options = normalizeAgentJobOptions(
    (cur.data as { options: Partial<AgentJobOptions> }).options
  );
  if (!(await isAnotherJobActive(sb, jobId))) {
    // PAT があれば即時 dispatch
    const dispatch = await dispatchAgentWorker({
      jobId,
      maxMinutes: 300,
      concurrency: options.concurrency,
    });
    if (dispatch.ok) {
      await sb
        .from("agent_jobs")
        .update({ last_dispatched_at: new Date().toISOString() })
        .eq("id", jobId);
    }
    after(async () => {
      try {
        const sbAfter = createSupabaseAdminClient();
        if (await isAnotherJobActive(sbAfter, jobId)) return;
        const result = await drainUntilBudgetOut(sbAfter, {
          maxMinutes: 4,
          concurrency: 1,
          runId: `vercel-resume-${Date.now().toString(36)}`,
          verbose: false,
        });
        if (
          result.lastResult &&
          !result.lastResult.finalized &&
          !result.lastResult.paused &&
          result.lastResult.remainingPending > 0
        ) {
          await triggerNextChain({ jobId, depth: 0 });
        }
      } catch (e) {
        console.warn(
          `[resumeAgentJob:after] drain failed: ${(e as Error).message}`
        );
      }
    });
  }

  return { ok: true };
}

/**
 * ジョブのラベル（notes）を更新する。
 * - 80 字までに切詰め
 * - 空文字列は null として保存
 */
export async function updateAgentJobNotes(
  jobId: string,
  notes: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const sb = createSupabaseAdminClient();

  const trimmed = (notes ?? "").trim().slice(0, 80);
  const value = trimmed.length === 0 ? null : trimmed;

  const r = await sb
    .from("agent_jobs")
    .update({ notes: value })
    .eq("id", jobId);
  if (r.error) return { ok: false, error: r.error.message };

  revalidatePath("/admin/articles/agent");
  revalidatePath(`/admin/articles/agent/${jobId}`);
  return { ok: true };
}

/**
 * 「今すぐ実行」/「ワーカー再起動」ボタンの裏側。
 *
 * - PAT 設定済みなら GitHub Actions に dispatch を投げる
 * - PAT 未設定でも Vercel after() で即時ドレインを試みる
 * - 他に走っているジョブがあれば直列ポリシーを尊重して待たせる（dispatch しない）
 * - 完了済 / キャンセル / 失敗 / 一時停止のジョブには使えない（resume を使う）
 */
export async function dispatchAgentJob(
  jobId: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const sb = createSupabaseAdminClient();
  const job = await sb
    .from("agent_jobs")
    .select("id, status, options")
    .eq("id", jobId)
    .maybeSingle();
  if (job.error || !job.data)
    return { ok: false, error: "ジョブが見つかりません" };
  const status = (job.data as { status: string }).status;
  if (
    status === "completed" ||
    status === "completed_with_errors" ||
    status === "cancelled" ||
    status === "failed"
  ) {
    return {
      ok: false,
      error: `${status} のジョブは実行できません。失敗のみ再試行を使ってください`,
    };
  }
  if (status === "paused") {
    return {
      ok: false,
      error: "一時停止中のジョブは「再開」ボタンを使ってください",
    };
  }

  // 直列ポリシー尊重：他に running が居たらこのジョブは待機させる。
  if (await isAnotherJobActive(sb, jobId)) {
    return {
      ok: false,
      error:
        "別のジョブが実行中です。完了後に自動でこのジョブが実行されます",
    };
  }

  const options = normalizeAgentJobOptions(
    (job.data as { options: Partial<AgentJobOptions> }).options
  );

  // PAT があれば GH Actions も dispatch（無くても続行）
  const dispatch = await dispatchAgentWorker({
    jobId,
    maxMinutes: 300,
    concurrency: options.concurrency,
  });
  if (dispatch.ok) {
    await sb
      .from("agent_jobs")
      .update({ last_dispatched_at: new Date().toISOString() })
      .eq("id", jobId);
  } else {
    console.log(
      `[dispatchAgentJob] PAT dispatch skipped/failed: ${dispatch.error}`
    );
  }

  // PAT 有無に関わらず Vercel 側でも即時ドレインを試みる。
  // 「Worker 再起動」は手動の強制実行なので、findNextClaimableJobId を経由せずに
  // このジョブを直接 runDrainJob で叩く（heartbeat fresh のハング状態でも動かせる）。
  after(async () => {
    try {
      const sbAfter = createSupabaseAdminClient();
      // 別のジョブが走っている場合は直列ポリシーを尊重して何もしない
      if (await isAnotherJobActive(sbAfter, jobId)) return;
      const result = await runDrainJob({
        sb: sbAfter,
        jobId,
        maxMinutes: 4,
        concurrency: 1,
        runId: `vercel-dispatch-${Date.now().toString(36)}`,
        verbose: false,
      });
      if (
        !result.finalized &&
        !result.paused &&
        result.remainingPending > 0
      ) {
        await triggerNextChain({ jobId, depth: 0 });
      }
    } catch (e) {
      console.warn(
        `[dispatchAgentJob:after] drain failed: ${(e as Error).message}`
      );
    }
  });

  revalidatePath(`/admin/articles/agent/${jobId}`);
  return { ok: true };
}
