/**
 * 06: 各社の最新有報XBRL CSVから事業内容テキストを抽出し、
 *     OpenAI (gpt-4o-mini) で第三者目線の企業概要を生成して
 *     companies.summary / summary_generated_at / summary_source_doc_id を更新する。
 *
 * 使い方:
 *   npx tsx scripts/etl/06-generate-summaries.ts                    # 未生成の会社のみ
 *   npx tsx scripts/etl/06-generate-summaries.ts --force            # 全件再生成
 *   npx tsx scripts/etl/06-generate-summaries.ts --edinet=E00381    # 1社のみ
 *   npx tsx scripts/etl/06-generate-summaries.ts --concurrency=7    # 並行ワーカー数（デフォルト1）
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fetchDocBinary, sleep } from "./lib/edinet";
import { parseXbrlCsvZip } from "./lib/xbrl";
import { supabaseAdmin } from "./lib/supabase";

const TEXT_FIELDS = [
  "jpcrp_cor:DescriptionOfBusinessTextBlock",
  "jpcrp_cor:CompanyHistoryTextBlock",
  "jpcrp_cor:BusinessPolicyBusinessEnvironmentIssuesToAddressEtcTextBlock",
];
const TEXT_CONTEXT = "FilingDateInstant";
const FALLBACK_CONTEXT = "CurrentYearDuration";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

type CompanyRow = {
  id: string;
  edinet_code: string;
  name: string;
  industry_code: string | null;
  industries: { name: string } | { name: string }[] | null;
  summary: string | null;
};

type LatestDoc = {
  doc_id: string;
  fiscal_year: number;
};

function arg(name: string): string | undefined {
  const pref = `--${name}=`;
  const a = process.argv.find((x) => x.startsWith(pref));
  if (a) return a.slice(pref.length);
  if (process.argv.includes(`--${name}`)) return "true";
  return undefined;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function generateSummary(args: {
  companyName: string;
  industryName: string | null;
  businessText: string;
}): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  const { companyName, industryName, businessText } = args;

  const system =
    "あなたは日本の上場企業を取材する経済ジャーナリストです。転職・就活で企業を調べている個人読者向けに、その会社がどんな会社かを淡々と紹介する記事を書きます。";
  const user = `次の有価証券報告書の抜粋をもとに、${companyName}（業界: ${
    industryName ?? "不明"
  }）がどんな会社かを 250〜350文字で書いてください。

文末は必ず「です・ます」調で統一してください（「〜である」「〜する」などの常体は使わない）。

以下のような書き方は避けてください:
- 「同社は〜を行う企業です。主な事業は〜。経営方針は〜。」のような紋切り型の構成
- 「中期経営計画」「新中期経営計画」「成長戦略」「収益性・資本効率の改善」「企業価値の向上」「持続的な成長」など、決算説明会的・経営計画的な常套句
- 「〜を目指しています」など、漠然とした目標表現
- 「優れた技術力」「高い競争力」「強み」など主観的な評価語
- 抽象的な抱負や所信表明

書くべきこと:
- 何を作って、誰に売っているのか（具体的な製品名・サービス名・主要顧客があれば名前で書く）
- どんな顧客接点を持っているか（店舗の業態・地域・規模、ECか卸か、BtoBかBtoCか等）
- 売上の柱、特徴的な事業構成
- 業界内でのポジション（最大手・専業・独立系・○○特化など、抜粋から読み取れる範囲で）
- 数字（店舗数・拠点数・シェア・主要取引先など）があれば積極的に使う

その他のルール:
- 企業の呼び方は「同社」で統一（「当社」は使わない）
- 文章の書き出しは紋切り型を避け、その会社で一番特徴的なことから入る（業態・歴史・主力商品など、会社ごとに変える）
- マークダウン・箇条書きは使わず、自然な段落として書く

【有価証券報告書からの抜粋】
${businessText.slice(0, 12000)}`;

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        choices: { message: { content: string } }[];
      };
      return json.choices[0].message.content.trim();
    }
    const err = await res.text();
    if (res.status === 429 && attempt < maxAttempts) {
      // "Please try again in Xs" / "Xms" を抽出してその時間だけ待機。なければ指数バックオフ。
      const m = err.match(/try again in ([\d.]+)(ms|s)/i);
      let waitMs = 2 ** attempt * 1000;
      if (m) {
        const v = parseFloat(m[1]);
        waitMs = m[2] === "s" ? v * 1000 : v;
      }
      // 余裕を持たせて 200ms 加算
      await sleep(waitMs + 200);
      continue;
    }
    if (res.status >= 500 && attempt < maxAttempts) {
      await sleep(2 ** attempt * 1000);
      continue;
    }
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
  }
  throw new Error("OpenAI: max retries exceeded");
}

async function fetchAndExtractBusinessText(docId: string): Promise<string> {
  // Use cached file if exists
  const cacheDir = path.resolve(process.cwd(), "scripts/etl/data/csv-cache");
  await fs.mkdir(cacheDir, { recursive: true });
  const cachePath = path.join(cacheDir, `${docId}.zip`);
  let buf: Buffer;
  try {
    buf = await fs.readFile(cachePath);
  } catch {
    buf = await fetchDocBinary(docId, 5);
    await fs.writeFile(cachePath, buf);
    await sleep(80);
  }
  const facts = await parseXbrlCsvZip(buf);
  const parts: string[] = [];
  for (const elementId of TEXT_FIELDS) {
    const f =
      facts.get(`${elementId}|${TEXT_CONTEXT}`) ??
      facts.get(`${elementId}|${FALLBACK_CONTEXT}`);
    if (f && f.value && f.value !== "－") {
      parts.push(stripHtml(f.value));
    }
  }
  return parts.join("\n\n");
}

async function processOne(
  c: CompanyRow,
  index: number,
  total: number
): Promise<"ok" | "skip" | "fail"> {
  const ind = Array.isArray(c.industries)
    ? c.industries[0]?.name ?? null
    : c.industries?.name ?? null;
  const tag = `[${index + 1}/${total}] ${c.edinet_code} ${c.name}`;
  try {
    const { data: latest } = await supabaseAdmin
      .from("financial_metrics")
      .select("doc_id, fiscal_year")
      .eq("company_id", c.id)
      .not("doc_id", "is", null)
      .order("fiscal_year", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest?.doc_id) {
      console.warn(`${tag} skip: no doc_id`);
      return "skip";
    }
    const docId = (latest as LatestDoc).doc_id;
    const text = await fetchAndExtractBusinessText(docId);
    if (text.length < 200) {
      console.warn(`${tag} skip: text too short (${text.length} chars)`);
      return "skip";
    }
    const summary = await generateSummary({
      companyName: c.name,
      industryName: ind,
      businessText: text,
    });
    await supabaseAdmin
      .from("companies")
      .update({
        summary,
        summary_generated_at: new Date().toISOString(),
        summary_source_doc_id: docId,
      })
      .eq("id", c.id);
    console.log(`${tag} OK (${summary.length}chars)`);
    return "ok";
  } catch (e) {
    console.error(`${tag} FAIL: ${e}`);
    return "fail";
  }
}

async function main() {
  const force = arg("force") === "true";
  const onlyEdinet = arg("edinet");
  const concurrency = Math.max(1, Number(arg("concurrency") ?? "1"));

  // ページネーションして全件取得（Supabase JS の暗黙1000行制限を回避）
  const PAGE = 1000;
  let collected: CompanyRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabaseAdmin
      .from("companies")
      .select("id, edinet_code, name, industry_code, industries(name), summary")
      .order("id")
      .range(from, from + PAGE - 1);
    if (onlyEdinet) q = q.eq("edinet_code", onlyEdinet);
    if (!force) q = q.is("summary", null);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    collected = collected.concat(data as unknown as CompanyRow[]);
    if (data.length < PAGE) break;
    if (onlyEdinet) break;
  }

  const targets = collected;
  console.log(`target companies: ${targets.length}, concurrency: ${concurrency}`);

  let ok = 0;
  let fail = 0;
  let skip = 0;
  let cursor = 0;
  const total = targets.length;

  // 共有キューから次のインデックスを取り出して順次処理する N 個のワーカー
  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= total) return;
      const result = await processOne(targets[idx], idx, total);
      if (result === "ok") ok++;
      else if (result === "skip") skip++;
      else fail++;
      // OpenAI レートリミット保護: ワーカー単位で軽く間引く
      await sleep(200);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  console.log(`\ndone: ok=${ok} skip=${skip} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
