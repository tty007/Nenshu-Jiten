/**
 * スタックしているジョブ／タスクを診断するスクリプト。
 */

import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Client } from "pg";

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

async function main() {
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const password = envOrThrow("SUPABASE_DB_PASSWORD");
  const ref = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)![1];
  const c = new Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    // 1) アクティブなジョブ
    const jobs = await c.query(
      `select id, status, notes,
              total_tasks, pending_count, running_count, succeeded_count,
              skipped_count, failed_count, cancelled_count,
              total_cost_usd,
              cancel_requested, pause_requested,
              created_at, started_at, finished_at,
              last_dispatched_at, last_heartbeat_at,
              now() as now_at
       from public.agent_jobs
       where status in ('pending','queued','running','paused')
       order by created_at desc`
    );
    console.log(`\n=== アクティブなジョブ ${jobs.rowCount} 件 ===`);
    for (const j of jobs.rows as Array<Record<string, unknown>>) {
      const heartbeat = j.last_heartbeat_at as string | null;
      const heartbeatAge = heartbeat
        ? Math.floor((Date.now() - new Date(heartbeat).getTime()) / 1000)
        : null;
      console.log(`
id           ${j.id}
status       ${j.status}    cancel=${j.cancel_requested} pause=${j.pause_requested}
notes        ${j.notes ?? "-"}
counts       total=${j.total_tasks} pending=${j.pending_count} running=${j.running_count} ok=${j.succeeded_count} skip=${j.skipped_count} fail=${j.failed_count} cancel=${j.cancelled_count}
cost         $${(j.total_cost_usd as number) ?? 0}
created      ${j.created_at}
started      ${j.started_at ?? "-"}
finished     ${j.finished_at ?? "-"}
dispatched   ${j.last_dispatched_at ?? "-"}
heartbeat    ${heartbeat ?? "-"}${heartbeatAge != null ? `  (${heartbeatAge}s ago)` : ""}`);

      // 2) 各ジョブのタスク（status 別の集計）
      const tCount = await c.query(
        `select status, count(*)::int as n
         from public.agent_job_tasks
         where job_id = $1
         group by status
         order by status`,
        [j.id]
      );
      console.log(`tasks_by_status: ${tCount.rows.map((r) => `${r.status}=${r.n}`).join(", ")}`);

      // 3) running タスクの詳細（リース状態）
      const rTasks = await c.query(
        `select id, sequence, status, attempts, max_attempts,
                sections_done, sections_total,
                locked_by, locked_until,
                started_at, finished_at,
                error_code, error_message
         from public.agent_job_tasks
         where job_id = $1 and status = 'running'
         order by sequence
         limit 5`,
        [j.id]
      );
      if (rTasks.rowCount && rTasks.rowCount > 0) {
        console.log(`-- running タスク（最大 5 件）--`);
        for (const t of rTasks.rows) {
          const lockedUntil = t.locked_until as string | null;
          const lockExpired = lockedUntil
            ? new Date(lockedUntil).getTime() < Date.now()
            : null;
          const startedAt = t.started_at as string | null;
          const elapsedSec = startedAt
            ? Math.floor(
                (Date.now() - new Date(startedAt).getTime()) / 1000
              )
            : null;
          console.log(
            `  seq=${t.sequence}  attempts=${t.attempts}/${t.max_attempts}  sec=${t.sections_done}/${t.sections_total}  elapsed=${elapsedSec ?? "?"}s  locked_by=${t.locked_by}  lease=${lockedUntil}${lockExpired === true ? " (EXPIRED)" : ""}`
          );
        }
      }

      // 4) 直近の失敗タスク
      const fTasks = await c.query(
        `select sequence, attempts, error_code, error_message
         from public.agent_job_tasks
         where job_id = $1 and status = 'failed'
         order by sequence
         limit 3`,
        [j.id]
      );
      if (fTasks.rowCount && fTasks.rowCount > 0) {
        console.log(`-- failed タスク（最大 3 件）--`);
        for (const t of fTasks.rows) {
          console.log(
            `  seq=${t.sequence}  attempts=${t.attempts}  err=${t.error_code}  msg=${(t.error_message as string | null)?.slice(0, 200) ?? "-"}`
          );
        }
      }
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("[diagnose] FAIL:", (e as Error).message);
  process.exit(1);
});
