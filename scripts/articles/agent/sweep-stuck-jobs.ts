/**
 * スイープ：自己再ディスパッチに失敗したジョブや、ハートビートが
 * 途絶えた孤児ジョブを復旧させる。GitHub Actions の cron から定期起動する。
 *
 * 役割:
 *   - last_heartbeat_at が古い running ジョブを見つけて再ディスパッチ
 *   - locked_until 切れの running タスクを pending に戻す
 *   - last_dispatched_at が古い queued ジョブを再ディスパッチ
 *
 * 使い方:
 *   npx tsx scripts/articles/agent/sweep-stuck-jobs.ts
 */

import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

const sb = createClient(
  envOrThrow("NEXT_PUBLIC_SUPABASE_URL"),
  envOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);

const HEARTBEAT_THRESHOLD_MIN = 10;
const QUEUED_DISPATCH_THRESHOLD_MIN = 5;

async function dispatchWorkflow(jobId: string, concurrency = 1): Promise<boolean> {
  const token = process.env.GH_AGENT_DISPATCH_TOKEN;
  if (!token) {
    console.warn("[sweep] GH_AGENT_DISPATCH_TOKEN 未設定。dispatch 不可");
    return false;
  }
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const repository = process.env.GITHUB_REPOSITORY;
  let resolvedOwner: string | null = null;
  let resolvedRepo: string | null = null;
  if (owner && repo) {
    resolvedOwner = owner;
    resolvedRepo = repo;
  } else if (repository && repository.includes("/")) {
    [resolvedOwner, resolvedRepo] = repository.split("/");
  }
  if (!resolvedOwner || !resolvedRepo) {
    console.warn("[sweep] リポジトリ情報なし");
    return false;
  }
  const ref = process.env.GH_AGENT_DISPATCH_REF ?? "main";
  const url = `https://api.github.com/repos/${resolvedOwner}/${resolvedRepo}/actions/workflows/articles-agent.yml/dispatches`;
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
        max_minutes: "300",
        concurrency: String(concurrency),
      },
    }),
  });
  if (res.status === 204) return true;
  const body = await res.text().catch(() => "");
  console.warn(`[sweep] dispatch failed: ${res.status} ${body.slice(0, 200)}`);
  return false;
}

async function main() {
  // 1) 孤児リース解放：running タスクで locked_until が切れているものを pending に戻す
  const unlocked = await sb
    .from("agent_job_tasks")
    .update({
      status: "pending",
      locked_by: null,
      locked_until: null,
    })
    .eq("status", "running")
    .lt("locked_until", new Date().toISOString())
    .select("id");
  if (unlocked.error) {
    console.warn(`[sweep] unlock error: ${unlocked.error.message}`);
  } else {
    console.log(`[sweep] released ${unlocked.data?.length ?? 0} stale leases`);
  }

  // 2) ハートビート切れの running ジョブ：再ディスパッチ候補
  const hbCutoff = new Date(
    Date.now() - HEARTBEAT_THRESHOLD_MIN * 60_000
  ).toISOString();
  const stale = await sb
    .from("agent_jobs")
    .select("id, status, options, pending_count, running_count, last_heartbeat_at")
    .eq("status", "running")
    .or(`last_heartbeat_at.is.null,last_heartbeat_at.lt.${hbCutoff}`);
  if (stale.error) {
    console.warn(`[sweep] stale query: ${stale.error.message}`);
  } else {
    for (const j of stale.data ?? []) {
      const job = j as {
        id: string;
        options: { concurrency?: number };
        pending_count: number;
        running_count: number;
      };
      if (job.pending_count + job.running_count === 0) continue;
      console.log(
        `[sweep] redispatch stale running job ${job.id} (pending=${job.pending_count}, running=${job.running_count})`
      );
      const ok = await dispatchWorkflow(job.id, job.options?.concurrency ?? 1);
      if (ok) {
        await sb
          .from("agent_jobs")
          .update({ last_dispatched_at: new Date().toISOString() })
          .eq("id", job.id);
      }
    }
  }

  // 3) queued のまま長く動いていないジョブを再ディスパッチ
  const qCutoff = new Date(
    Date.now() - QUEUED_DISPATCH_THRESHOLD_MIN * 60_000
  ).toISOString();
  const orphaned = await sb
    .from("agent_jobs")
    .select("id, options, last_dispatched_at, pending_count")
    .eq("status", "queued")
    .or(`last_dispatched_at.is.null,last_dispatched_at.lt.${qCutoff}`);
  if (orphaned.error) {
    console.warn(`[sweep] orphan query: ${orphaned.error.message}`);
  } else {
    for (const j of orphaned.data ?? []) {
      const job = j as {
        id: string;
        options: { concurrency?: number };
        pending_count: number;
      };
      if (job.pending_count === 0) continue;
      console.log(`[sweep] redispatch queued job ${job.id}`);
      const ok = await dispatchWorkflow(job.id, job.options?.concurrency ?? 1);
      if (ok) {
        await sb
          .from("agent_jobs")
          .update({ last_dispatched_at: new Date().toISOString() })
          .eq("id", job.id);
      }
    }
  }

  console.log("[sweep] done");
}

main()
  .catch((e) => {
    console.error("[sweep] fatal:", e);
    process.exit(1);
  })
  .then(() => process.exit(0));
