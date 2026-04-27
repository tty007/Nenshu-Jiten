/**
 * 2025年10月〜12月に最新有報を提出した384社のAI企業概要を生成。
 *
 *   - 各社の最新有報(financial_metrics の最新 doc_id)から事業説明テキストを抽出
 *   - OpenAI で第三者目線の概要を生成 → companies.summary を更新
 *   - 並列度10で実行（OpenAI と EDINET 両方を並列叩く）
 *   - 5分ごとにプログレスバーと残り時間を表示
 *   - 失敗会社は最後にレポート出力
 *
 * 使い方:
 *   npx tsx scripts/etl/generate-summaries-2025q4-parallel.ts
 *   npx tsx scripts/etl/generate-summaries-2025q4-parallel.ts --force   # 既存summaryも上書き
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fetchDocBinary, sleep } from "./lib/edinet";
import { parseXbrlCsvZip } from "./lib/xbrl";
import { supabaseAdmin } from "./lib/supabase";

const DATA_DIR = path.resolve(process.cwd(), "scripts/etl/data");
const TARGET_FILE = path.join(DATA_DIR, "target-companies-2025q4.json");
const FAILURES_FILE = path.join(DATA_DIR, "summary-failures-2025q4.json");
const CACHE_DIR = path.join(DATA_DIR, "csv-cache");

const DEFAULT_CONCURRENCY = 10;
const PROGRESS_INTERVAL_MS = 5 * 60 * 1000;

const TEXT_FIELDS = [
  "jpcrp_cor:DescriptionOfBusinessTextBlock",
  "jpcrp_cor:CompanyHistoryTextBlock",
  "jpcrp_cor:BusinessPolicyBusinessEnvironmentIssuesToAddressEtcTextBlock",
];
const TEXT_CONTEXT = "FilingDateInstant";
const FALLBACK_CONTEXT = "CurrentYearDuration";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

function arg(name: string): string | undefined {
  const pref = `--${name}=`;
  const a = process.argv.find((x) => x.startsWith(pref));
  if (a) return a.slice(pref.length);
  if (process.argv.includes(`--${name}`)) return "true";
  return undefined;
}

// ---------- Parallel utility & progress reporter -----------------------------

async function pMap<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "?";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m${s}s`;
  return `${s}s`;
}

function progressBar(done: number, total: number, width = 30): string {
  if (total <= 0) return "[" + " ".repeat(width) + "]";
  const filled = Math.min(width, Math.round((done / total) * width));
  return "[" + "#".repeat(filled) + "-".repeat(width - filled) + "]";
}

class Progress {
  start = Date.now();
  done = 0;
  failed = 0;
  skipped = 0;
  total: number;
  label: string;
  timer: ReturnType<typeof setInterval> | null = null;

  constructor(label: string, total: number) {
    this.label = label;
    this.total = total;
  }
  startTimer() {
    this.timer = setInterval(() => this.report(), PROGRESS_INTERVAL_MS);
  }
  stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  report() {
    const elapsed = (Date.now() - this.start) / 1000;
    const rate = this.done / Math.max(elapsed, 1e-6);
    const remaining = rate > 0 ? (this.total - this.done) / rate : Infinity;
    const pct = ((this.done / Math.max(this.total, 1)) * 100).toFixed(1);
    const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
    console.log(
      `[${ts}] [${this.label}] ${progressBar(this.done, this.total)} ` +
        `${this.done}/${this.total} (${pct}%) ` +
        `OK=${this.done - this.failed - this.skipped} NG=${this.failed} SKIP=${this.skipped} ` +
        `経過=${formatDuration(elapsed)} 残=${formatDuration(remaining)} ` +
        `(${rate.toFixed(2)}/s)`
    );
  }
}

// ---------- Helpers -----------------------------------------------------------

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

async function fetchAndExtractBusinessText(docId: string): Promise<string> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, `${docId}.zip`);
  let buf: Buffer;
  try {
    buf = await fs.readFile(cachePath);
  } catch {
    buf = await fetchDocBinary(docId, 5);
    await fs.writeFile(cachePath, buf);
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

  // Retry on 429/5xx with exponential backoff
  let attempt = 0;
  while (true) {
    attempt++;
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
      const json = (await res.json()) as { choices: { message: { content: string } }[] };
      return json.choices[0].message.content.trim();
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = Math.min(30000, 1000 * Math.pow(2, attempt));
      const body = await res.text();
      console.warn(
        `  OpenAI ${res.status} attempt=${attempt} → wait ${wait}ms: ${body.slice(0, 200)}`
      );
      await sleep(wait);
      continue;
    }
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 300)}`);
  }
}

// ---------- Main --------------------------------------------------------------

type EnrichedTarget = {
  edinetCode: string;
  filerName: string | null;
  industryName: string | null;
};

type CompanyRow = {
  id: string;
  edinet_code: string;
  name: string;
  summary: string | null;
};

type FailureRecord = {
  edinetCode: string;
  filerName: string | null;
  reason: string;
};

async function main() {
  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set in .env.local");
    process.exit(1);
  }
  const force = arg("force") === "true";
  const concurrency = arg("concurrency") ? Number(arg("concurrency")) : DEFAULT_CONCURRENCY;
  console.log(`concurrency=${concurrency}`);

  // 1) Load 384 target companies
  const targets: EnrichedTarget[] = JSON.parse(await fs.readFile(TARGET_FILE, "utf8"));
  const ecs = targets.map((t) => t.edinetCode);
  console.log(`target companies: ${targets.length} (Q4-2025 提出)`);

  // 2) Pull current rows from DB so we know which already have summaries.
  // We chunk the IN clause to keep the URL length sane.
  const companies: CompanyRow[] = [];
  for (let i = 0; i < ecs.length; i += 100) {
    const chunk = ecs.slice(i, i + 100);
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("id, edinet_code, name, summary")
      .in("edinet_code", chunk);
    if (error) throw error;
    companies.push(...((data ?? []) as CompanyRow[]));
  }
  console.log(`companies in DB: ${companies.length}/${targets.length}`);

  // 3) Fetch latest doc_id per company in chunks
  const companyIds = companies.map((c) => c.id);
  const latestDocByCompanyId = new Map<string, string>();
  for (let i = 0; i < companyIds.length; i += 100) {
    const chunk = companyIds.slice(i, i + 100);
    const { data, error } = await supabaseAdmin
      .from("financial_metrics")
      .select("company_id, doc_id, fiscal_year")
      .in("company_id", chunk)
      .not("doc_id", "is", null)
      .order("fiscal_year", { ascending: false });
    if (error) throw error;
    for (const r of (data ?? []) as Array<{ company_id: string; doc_id: string }>) {
      if (!latestDocByCompanyId.has(r.company_id)) {
        latestDocByCompanyId.set(r.company_id, r.doc_id);
      }
    }
  }

  // 4) Industry name lookup
  const indCodeByEc = new Map(targets.map((t) => [t.edinetCode, t.industryName]));

  // 5) Build work list
  const work = companies
    .filter((c) => force || !c.summary)
    .map((c) => ({
      company: c,
      docId: latestDocByCompanyId.get(c.id) ?? null,
      industryName: indCodeByEc.get(c.edinet_code) ?? null,
    }));
  const skippedExisting = companies.length - work.length;
  console.log(
    `processing ${work.length} (skipped ${skippedExisting} with existing summary, force=${force})`
  );

  const failures: FailureRecord[] = [];
  const progress = new Progress("summary", work.length);
  progress.startTimer();

  const flushFailures = async () => {
    try {
      await fs.writeFile(FAILURES_FILE, JSON.stringify(failures, null, 2), "utf8");
    } catch {}
  };

  await pMap(work, concurrency, async (item) => {
    const { company: c, docId, industryName } = item;
    try {
      if (!docId) {
        failures.push({
          edinetCode: c.edinet_code,
          filerName: c.name,
          reason: "no doc_id in financial_metrics",
        });
        progress.done++;
        progress.failed++;
        return;
      }
      const text = await fetchAndExtractBusinessText(docId);
      if (text.length < 200) {
        failures.push({
          edinetCode: c.edinet_code,
          filerName: c.name,
          reason: `business text too short (${text.length} chars)`,
        });
        progress.done++;
        progress.failed++;
        return;
      }
      const summary = await generateSummary({
        companyName: c.name,
        industryName,
        businessText: text,
      });
      const { error: upErr } = await supabaseAdmin
        .from("companies")
        .update({
          summary,
          summary_generated_at: new Date().toISOString(),
          summary_source_doc_id: docId,
        })
        .eq("id", c.id);
      if (upErr) throw upErr;

      progress.done++;
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null
            ? JSON.stringify(e)
            : String(e);
      failures.push({
        edinetCode: c.edinet_code,
        filerName: c.name,
        reason: msg,
      });
      progress.done++;
      progress.failed++;
      if (failures.length % 5 === 0) await flushFailures();
    }
  });

  progress.stopTimer();
  progress.report();
  await flushFailures();

  console.log(`\n=== サマリー ===`);
  console.log(`対象企業: ${targets.length}`);
  console.log(`既存summaryをスキップ: ${skippedExisting}`);
  console.log(`処理件数: ${work.length}`);
  console.log(`成功: ${work.length - failures.length}`);
  console.log(`失敗: ${failures.length}`);

  if (failures.length > 0) {
    console.log(`\n=== 失敗した会社 (${failures.length}社) ===`);
    for (const f of failures) {
      console.log(`  ${f.edinetCode} ${f.filerName}: ${f.reason.slice(0, 120)}`);
    }
    console.log(`\nfailures saved → ${FAILURES_FILE}`);
  } else {
    console.log(`全件成功`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
