/**
 * supabase-js (REST 経由) で active なジョブを調べるバージョン。
 * direct Postgres ホスト (db.<ref>.supabase.co) が DNS で解決できない環境用。
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

async function main() {
  const sb = createClient(
    envOrThrow("NEXT_PUBLIC_SUPABASE_URL"),
    envOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

  const jobs = await sb
    .from("agent_jobs")
    .select(
      "id, status, notes, total_tasks, pending_count, running_count, succeeded_count, skipped_count, failed_count, cancelled_count, total_cost_usd, cancel_requested, pause_requested, created_at, started_at, finished_at, last_dispatched_at, last_heartbeat_at"
    )
    .in("status", ["pending", "queued", "running", "paused"])
    .order("created_at", { ascending: false });

  if (jobs.error) {
    console.error("error:", jobs.error.message);
    process.exit(1);
  }
  console.log(`now: ${new Date().toISOString()}`);
  console.log(`active jobs: ${jobs.data?.length ?? 0}`);
  for (const j of jobs.data ?? []) {
    const heartbeat = j.last_heartbeat_at as string | null;
    const heartbeatAge = heartbeat
      ? Math.floor((Date.now() - new Date(heartbeat).getTime()) / 1000)
      : null;
    console.log(`
id           ${j.id}
status       ${j.status}    cancel=${j.cancel_requested} pause=${j.pause_requested}
notes        ${j.notes ?? "-"}
counts       total=${j.total_tasks} pending=${j.pending_count} running=${j.running_count} ok=${j.succeeded_count} skip=${j.skipped_count} fail=${j.failed_count} cancel=${j.cancelled_count}
cost         $${j.total_cost_usd}
created      ${j.created_at}
started      ${j.started_at ?? "-"}
finished     ${j.finished_at ?? "-"}
dispatched   ${j.last_dispatched_at ?? "-"}
heartbeat    ${heartbeat ?? "-"}${heartbeatAge != null ? `  (${heartbeatAge}s ago)` : ""}`);

    // running タスクの詳細
    const tasks = await sb
      .from("agent_job_tasks")
      .select(
        "id, sequence, status, attempts, sections_done, sections_total, locked_by, locked_until, started_at, finished_at, error_code, error_message"
      )
      .eq("job_id", j.id)
      .eq("status", "running")
      .order("sequence", { ascending: true })
      .limit(5);
    if (tasks.data && tasks.data.length > 0) {
      console.log(`-- running tasks --`);
      for (const t of tasks.data) {
        const lockedUntil = t.locked_until as string | null;
        const lockExpired = lockedUntil
          ? new Date(lockedUntil).getTime() < Date.now()
          : null;
        console.log(
          `  seq=${t.sequence}  attempts=${t.attempts}  sec=${t.sections_done}/${t.sections_total}  locked_by=${t.locked_by}  lease=${lockedUntil}${lockExpired === true ? " (EXPIRED)" : ""}`
        );
      }
    }
  }
}

main().catch((e) => {
  console.error("fail:", e);
  process.exit(1);
});
