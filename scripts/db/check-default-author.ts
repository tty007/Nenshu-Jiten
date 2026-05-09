/**
 * 年収辞典編集部 の著者レコードが存在するか確認するワンショットスクリプト。
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
    const r = await c.query(
      "select id, slug, name, title, is_active from public.article_authors where slug = $1 or name = $2 order by created_at limit 5",
      ["nenshu-editorial", "年収辞典編集部"]
    );
    console.log("matching authors:", r.rows);

    const all = await c.query(
      "select id, slug, name, is_active from public.article_authors order by display_order, name limit 20"
    );
    console.log(`total existing authors: ${all.rowCount}`);
    for (const r of all.rows) {
      console.log(`  - ${r.slug} | ${r.name} | active=${r.is_active}`);
    }
  } finally {
    await c.end();
  }
}

main().catch((e) => {
  console.error("[check] FAIL:", (e as Error).message);
  process.exit(1);
});
