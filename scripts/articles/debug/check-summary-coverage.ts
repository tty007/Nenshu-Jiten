/**
 * companies テーブルの summary / description のカバレッジを確認。
 * 記事化済み（articles に紐付いている）企業だけをまず見る。
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  // article に紐付いている companies を集計
  const { data: ac, error: e1 } = await sb
    .from("article_companies")
    .select("company_id");
  if (e1) throw e1;
  const cids = Array.from(new Set((ac ?? []).map((r) => r.company_id as string)));
  console.log(`articles に紐付いている company 数: ${cids.length}`);

  if (cids.length === 0) return;

  // 1000 件ずつチャンク取得
  const chunks: string[][] = [];
  for (let i = 0; i < cids.length; i += 1000) chunks.push(cids.slice(i, i + 1000));

  let total = 0;
  let summaryNonEmpty = 0;
  let summaryShort = 0; // 100字未満
  let descriptionNonEmpty = 0;
  let bothEmpty = 0;
  const examplesEmpty: { id: string; name: string }[] = [];
  const examplesShort: { id: string; name: string; len: number }[] = [];

  for (const chunk of chunks) {
    const { data, error } = await sb
      .from("companies")
      .select("id, name, summary, description")
      .in("id", chunk);
    if (error) throw error;
    for (const c of data ?? []) {
      total++;
      const s = ((c as any).summary ?? "") as string;
      const d = ((c as any).description ?? "") as string;
      if (s.trim().length > 0) summaryNonEmpty++;
      if (s.trim().length > 0 && s.trim().length < 100) summaryShort++;
      if (d.trim().length > 0) descriptionNonEmpty++;
      if (s.trim().length === 0 && d.trim().length === 0) {
        bothEmpty++;
        if (examplesEmpty.length < 8) examplesEmpty.push({ id: (c as any).id, name: (c as any).name });
      } else if (s.trim().length > 0 && s.trim().length < 100) {
        if (examplesShort.length < 8) examplesShort.push({ id: (c as any).id, name: (c as any).name, len: s.trim().length });
      }
    }
  }
  console.log("\n=== article 紐付き企業の summary カバレッジ ===");
  console.log(`  対象企業:                ${total}`);
  console.log(`  summary あり:            ${summaryNonEmpty} (${Math.round((summaryNonEmpty/total)*100)}%)`);
  console.log(`  うち 100字未満（短文）:  ${summaryShort}`);
  console.log(`  description あり:        ${descriptionNonEmpty} (${Math.round((descriptionNonEmpty/total)*100)}%)`);
  console.log(`  summary も description も空: ${bothEmpty}`);
  if (examplesEmpty.length) {
    console.log("\n  両方空の例:");
    examplesEmpty.forEach((e) => console.log(`    - ${e.id}  ${e.name}`));
  }
  if (examplesShort.length) {
    console.log("\n  summary が短い例:");
    examplesShort.forEach((e) => console.log(`    - ${e.id}  (${e.len}字)  ${e.name}`));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
