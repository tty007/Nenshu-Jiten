/**
 * 下書き記事を 1 つ選び、元データ（companies / financial_metrics /
 * industry_averages / article_xbrl_documents）と本文を並べてダンプする。
 *
 * 目的: 生成本文に「研修制度が整っている」「海外サポートあり」など、
 *       元データから根拠が取れない記述（ハルシネーション）が無いかを
 *       手作業で照合できる形式にする。
 *
 * 使い方:
 *   npx tsx scripts/articles/inspect-draft-article.ts
 *   npx tsx scripts/articles/inspect-draft-article.ts --articleId=<uuid>
 *   npx tsx scripts/articles/inspect-draft-article.ts --random
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("missing env NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
}
const sb = createClient(url, key, { auth: { persistSession: false } });

type Args = { articleId: string | null; random: boolean };
function parseArgs(): Args {
  const a = process.argv.slice(2);
  let articleId: string | null = null;
  let random = false;
  for (const v of a) {
    if (v.startsWith("--articleId=")) articleId = v.slice("--articleId=".length);
    else if (v === "--random") random = true;
  }
  return { articleId, random };
}

async function pickArticle(args: Args): Promise<string> {
  if (args.articleId) return args.articleId;
  // 直近の draft を 50 件取り、その中から 1 件を選ぶ。
  // --random なら無作為。なければ最新の draft。
  const { data, error } = await sb
    .from("articles")
    .select("id, title, updated_at, body_html")
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; title: string; updated_at: string; body_html: string }[];
  // body_html が空 or タイトルだけのものは除外（実体のあるドラフトを見たい）
  const nonEmpty = rows.filter((r) => (r.body_html ?? "").length > 200);
  if (nonEmpty.length === 0) throw new Error("実体のある draft 記事が見つかりません");
  const pick = args.random
    ? nonEmpty[Math.floor(Math.random() * nonEmpty.length)]
    : nonEmpty[0];
  return pick.id;
}

function section(title: string) {
  console.log("\n" + "=".repeat(80));
  console.log(`  ${title}`);
  console.log("=".repeat(80));
}

function sub(title: string) {
  console.log("\n" + "-".repeat(80));
  console.log(`  ${title}`);
  console.log("-".repeat(80));
}

async function main() {
  const args = parseArgs();
  const articleId = await pickArticle(args);

  // ---- 記事 ----
  const aRes = await sb
    .from("articles")
    .select(
      "id, title, slug, body_html, status, category_id, author_id, created_at, updated_at"
    )
    .eq("id", articleId)
    .maybeSingle();
  if (aRes.error || !aRes.data) throw aRes.error ?? new Error("article not found");
  const a = aRes.data as any;

  section("ARTICLE");
  console.log(JSON.stringify({
    id: a.id,
    title: a.title,
    slug: a.slug ?? null,
    status: a.status,
    category_id: a.category_id ?? null,
    author_id: a.author_id ?? null,
    created_at: a.created_at,
    updated_at: a.updated_at,
    body_html_length: (a.body_html ?? "").length,
  }, null, 2));

  // ---- 紐付企業 ----
  const acRes = await sb
    .from("article_companies")
    .select(
      `company_id, display_order,
       companies(id, edinet_code, securities_code, corporate_number, name, name_kana,
         industry_code, listed_market, description, summary,
         website_url, headquarters, founded_year, founded_at,
         representative, capital_stock_yen, fiscal_year_end_month,
         industries(name))`
    )
    .eq("article_id", articleId)
    .order("display_order", { ascending: true });
  if (acRes.error) throw acRes.error;
  const acRows = (acRes.data ?? []) as any[];

  section("LINKED COMPANIES (article_companies)");
  for (const r of acRows) {
    const c = r.companies as any;
    const ind = Array.isArray(c?.industries) ? c.industries[0] : c?.industries;
    console.log(JSON.stringify({
      company_id: r.company_id,
      display_order: r.display_order,
      name: c?.name,
      edinet_code: c?.edinet_code,
      securities_code: c?.securities_code ?? null,
      corporate_number: c?.corporate_number ?? null,
      industry_code: c?.industry_code ?? null,
      industry_name: ind?.name ?? null,
      listed_market: c?.listed_market ?? null,
      website_url: c?.website_url ?? null,
      headquarters: c?.headquarters ?? null,
      founded_year: c?.founded_year ?? null,
      founded_at: c?.founded_at ?? null,
      representative: c?.representative ?? null,
      capital_stock_yen: c?.capital_stock_yen ?? null,
      fiscal_year_end_month: c?.fiscal_year_end_month ?? null,
      description: c?.description ?? null,
      summary: c?.summary ?? null,
    }, null, 2));
  }

  // ---- financial_metrics ----
  if (acRows.length > 0) {
    const cid = acRows[0].company_id as string;
    const fmRes = await sb
      .from("financial_metrics")
      .select(
        `fiscal_year, average_annual_salary, average_age, average_tenure_years,
         employee_count, female_manager_ratio, average_overtime_hours,
         revenue, operating_income, ordinary_income, net_income,
         doc_id, submitted_at`
      )
      .eq("company_id", cid)
      .order("fiscal_year", { ascending: false });
    if (fmRes.error) throw fmRes.error;
    section("FINANCIAL_METRICS (history, latest → oldest)");
    console.log(JSON.stringify(fmRes.data ?? [], null, 2));

    // ---- industry_averages ----
    const c = acRows[0].companies as any;
    const indCode = c?.industry_code as string | null;
    if (indCode) {
      const iaRes = await sb
        .from("industry_averages")
        .select("*")
        .eq("industry_code", indCode)
        .order("fiscal_year", { ascending: false });
      if (iaRes.error) throw iaRes.error;
      section(`INDUSTRY_AVERAGES (industry_code=${indCode})`);
      console.log(JSON.stringify(iaRes.data ?? [], null, 2));
    }
  }

  // ---- article_xbrl_documents ----
  const xRes = await sb
    .from("article_xbrl_documents")
    .select("doc_id, edinet_code, submitted_at, fiscal_year")
    .eq("article_id", articleId)
    .order("submitted_at", { ascending: false });
  if (xRes.error) throw xRes.error;
  section("ARTICLE_XBRL_DOCUMENTS (linked source filings)");
  console.log(JSON.stringify(xRes.data ?? [], null, 2));

  // ---- 本文 ----
  section("BODY_HTML (full)");
  console.log(a.body_html ?? "(empty)");

  // ---- 本文を見出しで割って見やすく ----
  sub("BODY_HTML split by <h2>/<h3>");
  const html = String(a.body_html ?? "");
  const parts = html.split(/(?=<h[23][\s>])/i);
  for (let i = 0; i < parts.length; i++) {
    console.log(`\n--- part ${i} (len=${parts[i].length}) ---`);
    console.log(parts[i].slice(0, 4000));
    if (parts[i].length > 4000) console.log("...(truncated)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
