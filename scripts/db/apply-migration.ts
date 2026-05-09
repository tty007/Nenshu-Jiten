/**
 * 単発マイグレーション適用スクリプト。
 *
 * supabase CLI を使わず、SUPABASE_DB_PASSWORD と NEXT_PUBLIC_SUPABASE_URL から
 * 接続文字列を組み立てて pg で直接 SQL を流す。
 *
 * 使い方:
 *   npx tsx scripts/db/apply-migration.ts <migration-file.sql>
 */

import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Client } from "pg";

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

function projectRefFromUrl(url: string): string {
  // https://<ref>.supabase.co
  const m = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (!m) throw new Error(`unexpected SUPABASE URL format: ${url}`);
  return m[1];
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: tsx scripts/db/apply-migration.ts <file.sql>");
    process.exit(1);
  }
  const abs = path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) throw new Error(`not found: ${abs}`);
  const sql = fs.readFileSync(abs, "utf8");

  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const password = envOrThrow("SUPABASE_DB_PASSWORD");
  const ref = projectRefFromUrl(url);

  // 接続候補を順に試す:
  //   1) Direct connection (db.<ref>.supabase.co:5432)
  //   2) Session pooler ap-northeast-1 (postgres.<ref>@aws-0-ap-northeast-1...:5432)
  //   3) Session pooler us-east-1 (postgres.<ref>@aws-0-us-east-1...:5432)
  // Supabase のプロジェクト世代/リージョンによって有効なエンドポイントが違うため。
  const candidates: Array<{ label: string; cfg: ConnCfg }> = [
    {
      label: "direct db.<ref>",
      cfg: {
        host: `db.${ref}.supabase.co`,
        port: 5432,
        user: "postgres",
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
      },
    },
    {
      label: "pooler ap-northeast-1",
      cfg: {
        host: "aws-0-ap-northeast-1.pooler.supabase.com",
        port: 5432,
        user: `postgres.${ref}`,
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
      },
    },
    {
      label: "pooler us-east-1",
      cfg: {
        host: "aws-0-us-east-1.pooler.supabase.com",
        port: 5432,
        user: `postgres.${ref}`,
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
      },
    },
    {
      label: "pooler ap-southeast-1",
      cfg: {
        host: "aws-0-ap-southeast-1.pooler.supabase.com",
        port: 5432,
        user: `postgres.${ref}`,
        password,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
      },
    },
  ];

  console.log(`[migrate] file=${path.relative(process.cwd(), abs)}`);
  for (const c of candidates) {
    const client = new Client(c.cfg);
    const host =
      typeof c.cfg === "string" ? c.cfg : (c.cfg?.host ?? "?");
    try {
      console.log(`[migrate] try ${c.label} (${host})`);
      await client.connect();
      console.log(`[migrate] connected via ${c.label}`);
      await runAndClose(client, sql);
      return;
    } catch (e) {
      console.warn(`[migrate]   → ${(e as Error).message}`);
      try {
        await client.end();
      } catch {}
    }
  }
  throw new Error("all connection candidates failed");
}

type ConnCfg = ConstructorParameters<typeof Client>[0];

async function runAndClose(client: Client, sql: string) {
  try {
    console.log(`[migrate] 実行中…`);
    await client.query(sql);
    console.log(`[migrate] OK`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[migrate] FAIL:", (e as Error).message);
  process.exit(1);
});
