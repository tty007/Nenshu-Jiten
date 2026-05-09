/**
 * ハングしているジョブとそのタスクを救出するスクリプト。
 *
 *  - 該当ジョブの running タスクを pending に戻し、リースを解放
 *  - ジョブの last_heartbeat_at を 1 時間前に倒して、次のドレイン pickup 対象にする
 *
 * 使い方:
 *   npx tsx scripts/db/rescue-stuck-job.ts <jobId>
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
  const jobId = process.argv[2];
  if (!jobId) {
    console.error("usage: tsx scripts/db/rescue-stuck-job.ts <jobId>");
    process.exit(1);
  }

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
    // running タスクを pending に戻す（attempts はそのまま、引き継ぎで再試行可）
    const tasks = await c.query(
      `update public.agent_job_tasks
       set status='pending', locked_by=null, locked_until=null
       where job_id = $1 and status = 'running'
       returning id, sequence`,
      [jobId]
    );
    console.log(`released ${tasks.rowCount} running tasks → pending`);
    for (const r of tasks.rows) {
      console.log(`  seq=${r.sequence} id=${r.id}`);
    }

    // ジョブの heartbeat を 1 時間前にリセット → findNextClaimableJobId が拾える
    const j = await c.query(
      `update public.agent_jobs
       set last_heartbeat_at = now() - interval '1 hour'
       where id = $1
       returning id, status, pending_count, running_count`,
      [jobId]
    );
    console.log(`reset job heartbeat to 1h ago. now: ${JSON.stringify(j.rows[0])}`);
    console.log(
      "→ 次の cron auto-drain (最大 30 分以内) または「Worker 再起動」で再開されます"
    );
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("[rescue] FAIL:", (e as Error).message);
  process.exit(1);
});
