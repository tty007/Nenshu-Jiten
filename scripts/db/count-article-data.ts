/**
 * 削除対象になり得るデータの件数を表示するだけのスクリプト（dry-run）。
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

  const counts = async (table: string, filter?: (q: any) => any) => {
    let q: any = sb.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    const r = await q;
    return r.count ?? 0;
  };

  const total = await counts("articles");
  const drafts = await counts("articles", (q) => q.eq("status", "draft"));
  const published = await counts("articles", (q) =>
    q.eq("status", "published")
  );
  const archived = await counts("articles", (q) => q.eq("status", "archived"));
  const ac = await counts("article_companies");
  const axd = await counts("article_xbrl_documents");
  const jobs = await counts("agent_jobs");
  const tasks = await counts("agent_job_tasks");
  const authors = await counts("article_authors");
  const categories = await counts("article_categories");

  console.log(`articles               : ${total} 件`);
  console.log(`  draft                : ${drafts}`);
  console.log(`  published            : ${published}`);
  console.log(`  archived             : ${archived}`);
  console.log(`article_companies      : ${ac}`);
  console.log(`article_xbrl_documents : ${axd}`);
  console.log(`agent_jobs             : ${jobs}`);
  console.log(`agent_job_tasks        : ${tasks}`);
  console.log(`article_authors        : ${authors}（マスタ・通常は残す）`);
  console.log(`article_categories     : ${categories}（マスタ・通常は残す）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
