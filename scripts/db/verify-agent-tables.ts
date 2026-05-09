/**
 * 20260510000001_agent_jobs.sql 適用後の検証用スクリプト。
 * テーブル・インデックス・RPC が揃っているかを確認する。
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

function projectRefFromUrl(url: string): string {
  const m = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (!m) throw new Error(`unexpected SUPABASE URL format: ${url}`);
  return m[1];
}

async function main() {
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const password = envOrThrow("SUPABASE_DB_PASSWORD");
  const ref = projectRefFromUrl(url);
  const client = new Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: "postgres",
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const checks: Array<{ label: string; sql: string; expected: number | null }> = [
      {
        label: "table agent_jobs",
        sql: "select count(*)::int as c from information_schema.tables where table_schema='public' and table_name='agent_jobs'",
        expected: 1,
      },
      {
        label: "table agent_job_tasks",
        sql: "select count(*)::int as c from information_schema.tables where table_schema='public' and table_name='agent_job_tasks'",
        expected: 1,
      },
      {
        label: "rpc claim_next_task",
        sql: "select count(*)::int as c from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='claim_next_task'",
        expected: 1,
      },
      {
        label: "index idx_agent_jobs_status_created",
        sql: "select count(*)::int as c from pg_indexes where schemaname='public' and indexname='idx_agent_jobs_status_created'",
        expected: 1,
      },
      {
        label: "index idx_agent_job_tasks_pickup",
        sql: "select count(*)::int as c from pg_indexes where schemaname='public' and indexname='idx_agent_job_tasks_pickup'",
        expected: 1,
      },
      {
        label: "agent_jobs row count (should be 0)",
        sql: "select count(*)::int as c from public.agent_jobs",
        expected: null,
      },
    ];
    for (const ck of checks) {
      const r = await client.query(ck.sql);
      const v = (r.rows[0] as { c: number }).c;
      const ok = ck.expected === null || v === ck.expected;
      console.log(`  ${ok ? "✓" : "✗"} ${ck.label}: ${v}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[verify] FAIL:", (e as Error).message);
  process.exit(1);
});
