/**
 * 年収分析記事テンプレート（v2）を CLI から実行するワンオフ生成スクリプト。
 *
 * 設計：UI（右サイドバーのテンプレ → 全セクション生成 → エディタ反映 → 公開）
 *       と完全に同じ生成パスを通す。CLI 側は次のオーケストレーションだけを担当する：
 *
 *   1) 空 draft 記事を作成
 *   2) article_companies に対象企業を紐付け
 *   3) loadSalaryArticleContext(articleId) でコンテキストを取得
 *      （UI の「ダイアログを開いた直後」と同じデータが手に入る）
 *   4) SALARY_SECTIONS の順に generateSection({ sectionId, ctx, model }) を呼ぶ
 *      （UI で「すべて生成」を押した時と同じ）
 *   5) 各セクションの HTML を順番どおりに結合し、body_html / title を保存
 *   6) status を draft / published に更新
 *
 * すべての本文生成は lib/admin/articles/salary-template/{data,generators,sections}.ts
 * を直接 import して呼ぶ（CLI 側に再実装は持たない）。
 *
 * 使い方:
 *   npx tsx scripts/articles/generate-salary-article.ts --edinet=E03470 --status=draft
 *   npx tsx scripts/articles/generate-salary-article.ts --edinet=E03470 --status=published
 */

import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";
import {
  SALARY_SECTIONS,
  SALARY_SECTION_BY_ID,
} from "@/lib/admin/articles/salary-template/sections";
import { loadSalaryArticleContext } from "@/lib/admin/articles/salary-template/data";
import { generateSection } from "@/lib/admin/articles/salary-template/generators";

// =====================================================================
// 引数
// =====================================================================

type CliArgs = {
  edinet: string | null;
  status: "draft" | "published";
  title: string | null;
};

function parseArgs(argv: string[]): CliArgs {
  const map: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) map[m[1]] = m[2];
  }
  const status = map.status === "published" ? "published" : "draft";
  return {
    edinet: map.edinet ?? null,
    status,
    title: map.title ?? null,
  };
}

const args = parseArgs(process.argv.slice(2));

if (!args.edinet) {
  console.error(
    "usage: tsx scripts/articles/generate-salary-article.ts --edinet=<EDINET> [--status=draft|published] [--title=...]"
  );
  process.exit(1);
}

// =====================================================================
// Supabase 管理クライアント（記事 CRUD 用。本文生成側は data.ts が独自に張る）
// =====================================================================

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);
  return v;
}

const sb = createClient(
  envOrThrow("NEXT_PUBLIC_SUPABASE_URL"),
  envOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);

envOrThrow("OPENAI_API_KEY"); // generators.ts が直接読むので存在チェックだけ

// =====================================================================
// 1) 企業 → 2) 空 draft 記事作成 → 3) 紐付け
// =====================================================================

async function findCompany(edinet: string) {
  const r = await sb
    .from("companies")
    .select("id, edinet_code, name, industries(name)")
    .eq("edinet_code", edinet)
    .maybeSingle();
  if (r.error || !r.data)
    throw new Error(`company not found: ${edinet} (${r.error?.message ?? ""})`);
  return r.data as {
    id: string;
    edinet_code: string;
    name: string;
    industries: { name: string } | { name: string }[] | null;
  };
}

// =====================================================================
// タイトル生成（数値プロファイルに沿った SEO タイトルを AI で 1 行）
// =====================================================================

type TitleFacts = {
  companyName: string;
  industryName: string | null;
  fiscalYear: number | null;
  avgAnnualYen: number | null;
  industryAvgYen: number | null;
  diffVsIndustryYen: number | null;
};

async function generateTitle(facts: TitleFacts): Promise<{ title: string; cost: number }> {
  const apiKey = envOrThrow("OPENAI_API_KEY");
  const sys = `あなたは年収辞典の SEO 編集者です。検索クエリ「{社名} 年収」で上位を取れる、25〜36 字の自然な日本語タイトルを 1 行だけ返します。`;
  const user = `次の数値プロファイルに沿ってタイトルを 1 行だけ書いてください。

会社: ${facts.companyName}
業界: ${facts.industryName ?? "—"}
年度: ${facts.fiscalYear ?? "—"}
平均年収: ${facts.avgAnnualYen != null ? `${Math.round(facts.avgAnnualYen / 10000)} 万円` : "—"}
業界平均: ${facts.industryAvgYen != null ? `${Math.round(facts.industryAvgYen / 10000)} 万円` : "—"}
業界平均との差: ${facts.diffVsIndustryYen != null ? `${facts.diffVsIndustryYen >= 0 ? "+" : ""}${Math.round(facts.diffVsIndustryYen / 10000)} 万円` : "—"}

要件:
- 25〜36 字に収める
- 「${facts.companyName}」と「年収」を必ず含める（「年収」は「年収」「年収はいくら」「年収を分析」等の自然な使い方）
- 業界平均比・年度・金額のうち最も訴求力のある事実を 1 つだけ織り込む
- 釣り見出し・煽り表現・「！」「？」連発・絵文字は禁止
- 出力はタイトル文字列のみ（前置き・引用符・解説禁止）`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      temperature: 0.6,
      max_tokens: 80,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`title gen failed: ${res.status} ${errText.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const inTok = json.usage?.prompt_tokens ?? 0;
  const outTok = json.usage?.completion_tokens ?? 0;
  const cost = (inTok / 1_000_000) * 0.15 + (outTok / 1_000_000) * 0.6;
  let title = (json.choices[0]?.message?.content ?? "").trim();
  // 引用符・末尾の句点・改行を除去
  title = title.replace(/^[「『"'`]+|[」』"'`]+$/g, "").replace(/[\r\n].*$/s, "").trim();
  if (!title) throw new Error("title gen returned empty string");
  return { title, cost };
}

async function createDraftAndLink(
  companyId: string,
  initialTitle: string
): Promise<string> {
  const ins = await sb
    .from("articles")
    .insert({
      title: initialTitle,
      body_html: "",
      body_json: null,
      status: "draft",
    })
    .select("id")
    .single();
  if (ins.error) throw new Error(`articles insert: ${ins.error.message}`);
  const articleId = ins.data.id as string;

  const ac = await sb.from("article_companies").insert({
    article_id: articleId,
    company_id: companyId,
    display_order: 0,
  });
  if (ac.error) {
    await sb.from("articles").delete().eq("id", articleId);
    throw new Error(`article_companies insert: ${ac.error.message}`);
  }
  return articleId;
}

// =====================================================================
// 4) 全セクション生成（UI の「すべて生成」と同じパス）
// =====================================================================

const MODEL = "gpt-4o-mini" as const;

async function generateAllSections(articleId: string) {
  const ctxRes = await loadSalaryArticleContext(articleId);
  if (!ctxRes.ok) throw new Error(`loadContext: ${ctxRes.error}`);
  const ctx = ctxRes.data;

  console.log(
    `[ctx] company=${ctx.company.name} industry=${ctx.company.industry_name} metrics=${ctx.history.length}y peers=${ctx.peers.length}`
  );

  const results: Array<{ id: string; title: string; html: string; cost: number }> = [];
  let totalCost = 0;

  for (const sec of SALARY_SECTIONS) {
    process.stdout.write(`[gen] §${sec.id} ${sec.title} … `);
    const t0 = Date.now();
    const r = await generateSection({
      sectionId: sec.id,
      ctx,
      model: MODEL,
    });
    if (!r.ok) {
      console.log(`FAIL ${r.error}`);
      throw new Error(`section ${sec.id} failed: ${r.error}`);
    }
    const cost = r.data.usage.cost_usd ?? 0;
    totalCost += cost;
    const ms = Date.now() - t0;
    console.log(
      `ok (${ms} ms${cost > 0 ? `, $${cost.toFixed(4)}` : ""})`
    );
    results.push({
      id: sec.id,
      title: sec.title,
      html: r.data.html,
      cost,
    });
  }

  return { results, totalCost, ctx };
}

// =====================================================================
// 5) 結合 + 保存
// =====================================================================

function joinSections(results: { id: string; html: string }[]): string {
  return results
    .map((r) => r.html)
    .join("\n\n")
    .trim();
}

async function saveBody(articleId: string, title: string, body_html: string) {
  const u = await sb
    .from("articles")
    .update({
      title,
      body_html,
      body_json: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId);
  if (u.error) throw new Error(`update body: ${u.error.message}`);
}

async function setStatus(articleId: string, status: "draft" | "published") {
  const u = await sb
    .from("articles")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", articleId);
  if (u.error) throw new Error(`update status: ${u.error.message}`);
}

// =====================================================================
// メイン
// =====================================================================

async function main() {
  const company = await findCompany(args.edinet!);
  console.log(`[1/5] company resolved: ${company.name} (${company.edinet_code})`);

  // 暫定タイトルで draft を作る（ctx を取るには article が必要）
  const tempTitle = args.title ?? `${company.name} の年収`;
  const articleId = await createDraftAndLink(company.id, tempTitle);
  console.log(`[2/5] draft article created: ${articleId}`);

  console.log(`[3/5] generating ${SALARY_SECTIONS.length} sections`);
  const { results, totalCost, ctx } = await generateAllSections(articleId);

  // 数値ファクトに基づいた SEO タイトルを生成
  const latest = ctx.history[0];
  const ia = latest
    ? ctx.industry_averages.find((a) => a.fiscal_year === latest.fiscal_year)
    : null;
  let finalTitle = tempTitle;
  let titleCost = 0;
  if (args.title) {
    finalTitle = args.title;
    console.log(`[4/5] title: (provided) ${finalTitle}`);
  } else {
    process.stdout.write(`[4/5] title gen … `);
    try {
      const r = await generateTitle({
        companyName: ctx.company.name,
        industryName: ctx.company.industry_name,
        fiscalYear: latest?.fiscal_year ?? null,
        avgAnnualYen: latest?.average_annual_salary ?? null,
        industryAvgYen: ia?.avg_annual_salary ?? null,
        diffVsIndustryYen:
          latest?.average_annual_salary && ia?.avg_annual_salary
            ? latest.average_annual_salary - ia.avg_annual_salary
            : null,
      });
      finalTitle = r.title;
      titleCost = r.cost;
      console.log(`ok ($${titleCost.toFixed(4)}) → ${finalTitle}`);
    } catch (e) {
      console.log(`FAIL ${(e as Error).message} (fallback to default)`);
      finalTitle = `${company.name} の年収はいくら？平均年収・年代別・役職別の推計を整理`;
    }
  }

  const body_html = joinSections(results);
  await saveBody(articleId, finalTitle, body_html);
  const grandCost = totalCost + titleCost;
  console.log(
    `[4/5] body saved: ${body_html.length} chars, total ai cost = $${grandCost.toFixed(4)}`
  );

  if (args.status === "published") {
    await setStatus(articleId, "published");
    console.log(`[5/5] published`);
  } else {
    console.log(`[5/5] kept as draft`);
  }

  console.log(
    `[done] preview: /admin/articles/${articleId}/preview  edit: /admin/articles/${articleId}`
  );
  console.log(`[done] articleId=${articleId}`);
}

main().catch((e) => {
  console.error("[error]", e);
  process.exit(1);
});

// 未使用 import 警告回避（型 export を 1 つ保持）
void SALARY_SECTION_BY_ID;
