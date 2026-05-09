/**
 * 記事 + ジョブデータの全件削除。マスタ（authors / categories）は残す。
 *
 * 順序:
 *   1) agent_jobs を削除 → agent_job_tasks は CASCADE で消える
 *   2) articles を削除 → article_companies / article_xbrl_documents は CASCADE で消える
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

  // 1) agent_jobs を全削除（FK on delete cascade で agent_job_tasks も消える）
  console.log("[1/2] agent_jobs を削除中…");
  const j = await sb.from("agent_jobs").delete().not("id", "is", null);
  if (j.error) {
    console.error("agent_jobs delete failed:", j.error.message);
    process.exit(1);
  }
  console.log("  → agent_jobs 削除 OK");

  // 2) articles を全削除（cascade で article_companies / article_xbrl_documents も消える）
  console.log("[2/2] articles を削除中…");
  const a = await sb.from("articles").delete().not("id", "is", null);
  if (a.error) {
    console.error("articles delete failed:", a.error.message);
    process.exit(1);
  }
  console.log("  → articles 削除 OK");

  // 結果確認
  const counts = async (table: string) => {
    const r = await sb.from(table).select("*", { count: "exact", head: true });
    return r.count ?? 0;
  };
  console.log("\n=== 削除後の件数 ===");
  for (const t of [
    "articles",
    "article_companies",
    "article_xbrl_documents",
    "agent_jobs",
    "agent_job_tasks",
    "article_authors",
    "article_categories",
  ]) {
    console.log(`${t.padEnd(24)} : ${await counts(t)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
