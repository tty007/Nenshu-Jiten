import "server-only";
import { estimateCostUsd, AI_MODELS, type AiModelId } from "../ai-write-prompt";
import { estimateAgeSalary } from "@/lib/calc/age-salary";
import { estimateRoleSalary } from "@/lib/calc/role-salary";
import { estimateLifetimeEarnings } from "@/lib/calc/lifetime-earnings";
import {
  estimateTakeHome,
  estimateTakeHomeReferenceTable,
} from "@/lib/calc/take-home";
import type { SalaryArticleContext } from "./data";

// =====================================================================
// 共通ヘルパー
// =====================================================================

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toManYen(yen: number | null | undefined): string {
  if (yen == null || !Number.isFinite(yen)) return "—";
  return `${Math.round(yen / 10000).toLocaleString("ja-JP")} 万円`;
}

function toBigYen(yen: number | null | undefined): string {
  if (yen == null || !Number.isFinite(yen)) return "—";
  if (Math.abs(yen) >= 1_0000_0000)
    return `${(yen / 1_0000_0000).toFixed(1)} 億円`;
  if (Math.abs(yen) >= 10000)
    return `${(yen / 10000).toFixed(0)} 万円`;
  return `${yen.toLocaleString("ja-JP")} 円`;
}

function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("ja-JP");
}

function fmtDateJp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function todayJp(): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * 生成記事の重要部分を蛍光ペン（黄色マーカー）でくくる。
 * エディタ・公開ページ両方の `mark.tiptap-mark` スタイルがそのまま当たる。
 * 既に <mark> 内になっている文字列を二重マークしないよう、呼び出し側で
 * ピンポイントに使う想定。
 */
function markText(html: string): string {
  return `<mark class="tiptap-mark">${html}</mark>`;
}

/**
 * セクション全体を「メンバー限定」ブロックで包む。
 * data-member-only="true" の <div> でラップ。
 * 公開ページ側 CSS で「見出しは見える / 中身はモザイク」になる。
 *
 * @param innerHtml h2 から始まる完成したセクション HTML（h2 + 本文）
 */
function wrapMemberOnly(innerHtml: string): string {
  return `<div data-member-only="true" class="member-only">\n${innerHtml}\n</div>`;
}

// =====================================================================
// 個別セクション：決定論的（AI 不要）
// =====================================================================

export type GenerateResult = {
  html: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
  };
  warnings?: string[];
};

const ZERO_USAGE = { input_tokens: 0, output_tokens: 0, cost_usd: 0 };

function genHeader(ctx: SalaryArticleContext): GenerateResult {
  const { company } = ctx;

  const html = `
<h2>記事概要</h2>
<p>本記事は ${escapeHtml(company.name)}（${escapeHtml(
    company.edinet_code
  )}${
    company.securities_code
      ? ` / 証券 ${escapeHtml(company.securities_code)}`
      : ""
  }）の年収について、<strong>平均年収・年代別の推定年収・役職別の推定年収・初任給・賞与・手取り推計・生涯年収・同業他社比較</strong>を整理したページです。<strong>有価証券報告書（EDINET）</strong>の公開数値と<strong>厚生労働省「賃金構造基本統計調査（賃金センサス）」「役職別賃金」</strong>を一次ソースとしています。${
    company.industry_name
      ? `業種は${markText(`「${escapeHtml(company.industry_name)}」`)}に分類されます。`
      : ""
  }</p>
`.trim();
  return { html, usage: ZERO_USAGE };
}

function genEntityPanel(ctx: SalaryArticleContext): GenerateResult {
  const c = ctx.company;
  const latest = ctx.history[0];

  // 値の組み立て（null は null のままにし、後段で行ごと除外）
  const foundedHtml: string | null = c.founded_at
    ? escapeHtml(fmtDateJp(c.founded_at))
    : c.founded_year != null
    ? `${c.founded_year} 年`
    : null;
  const capitalHtml: string | null =
    c.capital_stock_yen != null ? toBigYen(c.capital_stock_yen) : null;
  const fiscalMonthHtml: string | null =
    c.fiscal_year_end_month != null
      ? `${c.fiscal_year_end_month} 月`
      : null;

  const websiteHtml = c.website_url
    ? `<a href="${escapeHtml(
        c.website_url
      )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        c.website_url
      )}</a>`
    : null;

  const corporateHtml = c.corporate_number
    ? `<a href="https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=${encodeURIComponent(
        c.corporate_number
      )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        c.corporate_number
      )}</a>`
    : null;

  // 商号は カナ があれば併記して 1 行にまとめる
  const nameHtml = c.name_kana
    ? `${escapeHtml(c.name)}<br/><span style="color: #6b7280; font-size: 0.85em;">${escapeHtml(c.name_kana)}</span>`
    : escapeHtml(c.name);

  // 直近年度の業績・社員数（数値が無い場合は行ごと除外）
  const fiscalYearTag =
    latest?.fiscal_year != null
      ? ` <span style="color: #6b7280; font-size: 0.85em;">（${latest.fiscal_year} 年度）</span>`
      : "";
  const revenueHtml: string | null =
    latest?.revenue != null
      ? `${toBigYen(latest.revenue)}${fiscalYearTag}`
      : null;
  const operatingIncomeHtml: string | null =
    latest?.operating_income != null
      ? `${toBigYen(latest.operating_income)}${fiscalYearTag}`
      : null;
  const ordinaryIncomeHtml: string | null =
    latest?.ordinary_income != null
      ? `${toBigYen(latest.ordinary_income)}${fiscalYearTag}`
      : null;
  const employeeCountHtml: string | null =
    latest?.employee_count != null
      ? `${formatNumber(latest.employee_count)} 人${fiscalYearTag}`
      : null;

  // 表示順：基本属性 → 業績・人員（直近年度）→ 上場・運営 → 識別子
  const rows: Array<[string, string | null]> = [
    // ── 基本属性 ──
    ["商号", nameHtml],
    ["業種", c.industry_name ? escapeHtml(c.industry_name) : null],
    ["本社所在地", c.headquarters ? escapeHtml(c.headquarters) : null],
    ["設立", foundedHtml],
    ["代表者", c.representative ? escapeHtml(c.representative) : null],
    ["資本金", capitalHtml],
    // ── 直近年度の業績・人員 ──
    ["売上高", revenueHtml],
    ["営業利益", operatingIncomeHtml],
    ["経常利益", ordinaryIncomeHtml],
    ["社員数", employeeCountHtml],
    // ── 上場・運営 ──
    ["上場市場", c.listed_market ? escapeHtml(c.listed_market) : null],
    ["決算月", fiscalMonthHtml],
    ["公式サイト", websiteHtml],
    // ── 識別子（外部 DB 参照）──
    [
      "証券コード",
      c.securities_code ? escapeHtml(c.securities_code) : null,
    ],
    ["法人番号", corporateHtml],
  ];

  // null や 空文字 の行を除外
  const filledRows = rows.filter(
    (r): r is [string, string] => r[1] != null && r[1] !== ""
  );

  const rowsHtml = filledRows
    .map(
      ([k, v]) =>
        `<tr><th style="width: 30%;">${escapeHtml(k)}</th><td>${v}</td></tr>`
    )
    .join("");

  // データページ（本体ページ）への動線：本記事は「分析」、データの一次ページは別途
  const dataPageHtml = c.edinet_code
    ? `<p style="margin-top: 0.85em;">本記事は ${escapeHtml(
        c.name
      )} の年収を分析したページです。最新の財務指標・年代別賃金カーブ・チャートなど一次データは <a href="/companies/${encodeURIComponent(
        c.edinet_code
      )}">${escapeHtml(c.name)} のデータページ</a> をご覧ください。</p>`
    : "";

  const html = `
<h2>企業基本情報</h2>
<table>
  <tbody>${rowsHtml}</tbody>
</table>
${dataPageHtml}
`.trim();

  return { html, usage: ZERO_USAGE };
}

function genSources(ctx: SalaryArticleContext): GenerateResult {
  const { history } = ctx;
  const docs = history
    .filter((m) => m.doc_id)
    .slice(0, 5)
    .map(
      (m) =>
        `<li>${m.fiscal_year} 年度 有価証券報告書: EDINET ${escapeHtml(
          m.doc_id ?? ""
        )}（提出 ${fmtDateJp(m.submitted_at)}）</li>`
    )
    .join("");

  const html = `
<h2>出典・編集体制</h2>
<h3>主な出典</h3>
<ul>
  ${docs || "<li>EDINET 提出書類（取得中）</li>"}
  <li>厚生労働省「賃金構造基本統計調査（賃金センサス）令和 7 年」</li>
  <li>厚生労働省「役職別賃金」</li>
  <li>給与所得控除・社会保険料率・所得税累進税率（令和 6 年度準拠）</li>
</ul>
<h3>編集ポリシー</h3>
<p>本記事の数値は EDINET に提出された有価証券報告書を一次ソースとし、年代別・役職別の推計には公的統計を用いています。<strong>断定が難しい数値は推計であることを明記</strong>し、数値の根拠と前提を本文中で開示します。記事公開後も、新しい有価証券報告書の提出を受けて随時更新します。</p>
<p>誤りのご指摘は編集部までお寄せください。</p>
`.trim();
  return { html, usage: ZERO_USAGE };
}

function genHeroNumbers(ctx: SalaryArticleContext): {
  latest_year: number | null;
  latest_salary: number | null;
  prev_salary: number | null;
  yoy_yen: number | null;
  yoy_pct: number | null;
  industry_avg: number | null;
  diff_vs_industry: number | null;
  five_year_growth_pct: number | null;
} {
  const { history, industry_averages } = ctx;
  const latest = history[0] ?? null;
  const prev = history[1] ?? null;
  const fiveYearAgo = history.find(
    (m) => latest && m.fiscal_year === latest.fiscal_year - 4
  );

  let yoy_yen: number | null = null;
  let yoy_pct: number | null = null;
  if (latest?.average_annual_salary && prev?.average_annual_salary) {
    yoy_yen = latest.average_annual_salary - prev.average_annual_salary;
    yoy_pct = (yoy_yen / prev.average_annual_salary) * 100;
  }

  let five_year_growth_pct: number | null = null;
  if (latest?.average_annual_salary && fiveYearAgo?.average_annual_salary) {
    five_year_growth_pct =
      ((latest.average_annual_salary - fiveYearAgo.average_annual_salary) /
        fiveYearAgo.average_annual_salary) *
      100;
  }

  let industry_avg: number | null = null;
  let diff_vs_industry: number | null = null;
  if (latest && industry_averages.length > 0) {
    const ia = industry_averages.find(
      (a) => a.fiscal_year === latest.fiscal_year
    );
    industry_avg = ia?.avg_annual_salary ?? null;
    if (industry_avg && latest.average_annual_salary) {
      diff_vs_industry = latest.average_annual_salary - industry_avg;
    }
  }

  return {
    latest_year: latest?.fiscal_year ?? null,
    latest_salary: latest?.average_annual_salary ?? null,
    prev_salary: prev?.average_annual_salary ?? null,
    yoy_yen,
    yoy_pct,
    industry_avg,
    diff_vs_industry,
    five_year_growth_pct,
  };
}

// =====================================================================
// AI 共通ヘルパー
// =====================================================================

async function callOpenAi(args: {
  model: AiModelId;
  system: string;
  user: string;
  maxOutputTokens: number;
  temperature?: number;
}): Promise<
  | {
      ok: true;
      content: string;
      usage: { input_tokens: number; output_tokens: number; cost_usd: number };
    }
  | { ok: false; error: string }
> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "OPENAI_API_KEY が未設定です" };
  const modelDef = AI_MODELS[args.model];
  if (!modelDef) return { ok: false, error: `未知のモデル: ${args.model}` };

  const maxAttempts = 4;
  let lastErr = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: args.model,
          messages: [
            { role: "system", content: args.system },
            { role: "user", content: args.user },
          ],
          temperature: args.temperature ?? 0.4,
          max_tokens: Math.min(modelDef.max_output_tokens, args.maxOutputTokens),
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          choices: { message: { content: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const raw = json.choices[0]?.message?.content?.trim() ?? "";
        const inTok = json.usage?.prompt_tokens ?? 0;
        const outTok = json.usage?.completion_tokens ?? 0;
        const cost = estimateCostUsd({
          model: args.model,
          inputTokens: inTok,
          outputTokens: outTok,
        });
        return {
          ok: true,
          content: postProcessHighlights(
            demoteAiHeadings(sanitizeAiHtml(raw))
          ),
          usage: { input_tokens: inTok, output_tokens: outTok, cost_usd: cost },
        };
      }
      const errText = await res.text();
      lastErr = `OpenAI ${res.status}: ${errText.slice(0, 200)}`;
      if (res.status === 429 && attempt < maxAttempts) {
        const m = errText.match(/try again in ([\d.]+)(ms|s)/i);
        let waitMs = 2 ** attempt * 1000;
        if (m) {
          const v = parseFloat(m[1]);
          waitMs = m[2] === "s" ? v * 1000 : v;
        }
        await sleep(waitMs + 200);
        continue;
      }
      if (res.status >= 500 && attempt < maxAttempts) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      return { ok: false, error: lastErr };
    } catch (e) {
      lastErr = (e as Error).message ?? String(e);
      if (attempt < maxAttempts) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      return { ok: false, error: lastErr };
    }
  }
  return { ok: false, error: lastErr || "OpenAI: max retries exceeded" };
}

function sanitizeAiHtml(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:html|markdown)?\s*\n?/i, "");
  s = s.replace(/\n?```\s*$/i, "");
  return s.trim();
}

/**
 * ページ自体の <h1> は記事タイトル 1 つだけ（SEO/a11y のベストプラクティス）。
 * 各セクションの外側 wrapper は generators.ts が <h2> を発行するため、
 * AI 本文中の <h1>・<h2> はすべて見出し階層違反となる。<h3> に降格させて
 * セクション内の小見出しとして並べる。
 */
function demoteAiHeadings(html: string): string {
  return html
    .replace(/<h1\b([^>]*)>/gi, "<h3$1>")
    .replace(/<\/h1>/gi, "</h3>")
    .replace(/<h2\b([^>]*)>/gi, "<h3$1>")
    .replace(/<\/h2>/gi, "</h3>");
}

/**
 * AI 出力内の `<mark>` を蛍光ペン用クラスに正規化し、数を上限で抑える。
 *  - <mark>, <mark class="...">, <mark style="...">  →  <mark class="tiptap-mark">
 *  - セクション内で 4 箇所を超えたら、超過分は中身だけ残してアンラップ
 *    （ハイライトが多すぎると蛍光ペン本来の意味を失うため）
 */
function postProcessHighlights(html: string, maxMarks = 4): string {
  // 1) 全 <mark> 開始タグを class="tiptap-mark" に統一（属性は捨てる）
  let s = html.replace(/<mark\b[^>]*>/gi, '<mark class="tiptap-mark">');
  // 2) 上限超過分は中身だけ残してアンラップ
  const total = (s.match(/<mark class="tiptap-mark">/g) ?? []).length;
  if (total <= maxMarks) return s;
  let count = 0;
  s = s.replace(
    /<mark class="tiptap-mark">([\s\S]*?)<\/mark>/g,
    (full, inner: string) => {
      count++;
      return count <= maxMarks ? full : inner;
    }
  );
  return s;
}

const BASE_SYSTEM = `あなたは年収辞典の経済ジャーナリスト・編集ライターです。
読者は転職検討者・現職社員・就活生・投資家。与えられた数値データのみを使って、ライター品質の本文を書きます。

【出力形式】
- HTML で返す（TipTap が解釈できる以下のタグのみ：h2, h3, h4, p, ul, ol, li, strong, em, mark, a, table, thead, tbody, tr, th, td）
- 本文のみを返す（前置き・後書き・コードフェンス・「以下の通りです」のような説明文は禁止）
- 文章のあいだに <p> 区切りを徹底する

【書き方のルール】
- 文末は「です・ます」基本、ところどころ体言止めやダッシュ「——」でリズムを変える
- 「注目すべきは」「実は」「とはいえ」「ただし」「一方で」で論理転換を入れる
- パーセント数値は最低 1 つ金額換算（例：「+12%」→「およそ 100 万円多い」）
- 数字は与えられた値だけを使う。捏造禁止。因果関係は断定しない

【重要部分のハイライト（蛍光ペン）】
- セクションの「最重要の結論」と「読者がメモしたい数値・キーワード」を <mark class="tiptap-mark"> で囲む
- 1 セクションあたり合計 1〜3 箇所だけ。多くても 4 箇所まで。それ以上は付けない（蛍光ペンの意味が失われる）
- 囲むのは短い句のみ（おおむね 5〜30 字）。長い文を丸ごと包まない
- 良い例:
  - <mark class="tiptap-mark">業界平均より +120 万円高い水準</mark>
  - <mark class="tiptap-mark">5 年で +18% の伸び</mark>
  - 平均年収は <mark class="tiptap-mark">720 万円</mark> で、35 歳前後の中堅層が中心です。
- 悪い例（やらない）:
  - 段落全体を <mark> で囲む
  - 「優れた」「高い水準」のような主観的表現を囲む
  - すべての数字を機械的に囲む

【禁止表現】
- 「〜することができます」「〜と言えるでしょう」「〜と考えられます」
- 「非常に」「大変」「極めて」「総合的に」「全体的に」「基本的には」
- 「〜が重要です」「〜が求められています」「〜していきます」「いかがでしたか」
- 「持続的成長」「企業価値向上」など経営計画用語
- 「優れた技術力」「高い競争力」「業界トップクラス」など主観的賛辞`;

// =====================================================================
// AI セクション
// =====================================================================

async function genHero(
  ctx: SalaryArticleContext,
  model: AiModelId
): Promise<GenerateResult | { ok: false; error: string }> {
  const c = ctx.company;
  const n = genHeroNumbers(ctx);

  const kpiRows = [
    ["平均年収", toManYen(n.latest_salary)],
    [
      "前年比",
      n.yoy_yen != null && n.yoy_pct != null
        ? `${n.yoy_yen >= 0 ? "+" : ""}${toManYen(n.yoy_yen)}（${n.yoy_pct.toFixed(1)}%）`
        : "—",
    ],
    [
      "業界平均比",
      n.diff_vs_industry != null
        ? `${n.diff_vs_industry >= 0 ? "+" : ""}${toManYen(n.diff_vs_industry)}`
        : "—",
    ],
    [
      "5 年伸び率",
      n.five_year_growth_pct != null
        ? `${n.five_year_growth_pct >= 0 ? "+" : ""}${n.five_year_growth_pct.toFixed(1)}%`
        : "—",
    ],
    [
      "平均年齢",
      ctx.history[0]?.average_age != null
        ? `${ctx.history[0]?.average_age} 歳`
        : "—",
    ],
    [
      "平均勤続",
      ctx.history[0]?.average_tenure_years != null
        ? `${ctx.history[0]?.average_tenure_years} 年`
        : "—",
    ],
  ];

  // 「平均年収」セル（先頭）は記事の結論に直結するため蛍光ペンで強調
  const kpiHtml = `<table><thead><tr>${kpiRows
    .map(([k]) => `<th>${escapeHtml(k)}</th>`)
    .join("")}</tr></thead><tbody><tr>${kpiRows
    .map(([k, v], i) => {
      const cell = escapeHtml(String(v));
      return `<td>${i === 0 && k === "平均年収" ? markText(cell) : cell}</td>`;
    })
    .join("")}</tr></tbody></table>`;

  // 結論文を AI に書かせる
  const userPrompt = `${c.name} の最新年度の以下の数値から、読者がひと目で結論を理解できる「結論段落」を 1 段落（150〜250 字）書いてください。
- 平均年収: ${toManYen(n.latest_salary)}（${n.latest_year ?? "—"}年度）
- 前年比: ${n.yoy_yen != null ? `${n.yoy_yen >= 0 ? "+" : ""}${toManYen(n.yoy_yen)}` : "—"}
- 業界平均比: ${n.diff_vs_industry != null ? `${n.diff_vs_industry >= 0 ? "+" : ""}${toManYen(n.diff_vs_industry)}` : "—"}
- 5 年伸び率: ${n.five_year_growth_pct != null ? `${n.five_year_growth_pct >= 0 ? "+" : ""}${n.five_year_growth_pct.toFixed(1)}%` : "—"}
- 業界: ${c.industry_name ?? "—"}

<p> タグで囲んだ 1 段落だけを返してください。見出しは付けないこと。`;

  const r = await callOpenAi({
    model,
    system: BASE_SYSTEM,
    user: userPrompt,
    maxOutputTokens: 600,
  });
  if (!r.ok) return r;

  const headingTail =
    n.latest_salary != null
      ? `${Math.round(n.latest_salary / 10000).toLocaleString("ja-JP")} 万円`
      : "—";
  const html = `
<h2>${escapeHtml(c.name)}の年収は${headingTail}</h2>
${r.content}
${kpiHtml}
`.trim();

  return { html, usage: r.usage };
}

async function genAboutCompany(
  ctx: SalaryArticleContext,
  model: AiModelId
): Promise<GenerateResult | { ok: false; error: string }> {
  const c = ctx.company;
  const latest = ctx.history[0];
  const userPrompt = `${c.name} について、3 つのパートを書いてください。

【パート 1：会社概要】（h3「${c.name} とは」、200〜300 字）
- 業種: ${c.industry_name ?? "—"}
- 上場市場: ${c.listed_market ?? "—"}
- 本社: ${c.headquarters ?? "—"}
- 設立: ${c.founded_year ?? c.founded_at ?? "—"}
- 概要: ${c.summary ?? c.description ?? "（未取得）"}

【パート 2：在籍メリット】（h3「${c.name} に在籍するメリット」、地の文 250〜400 字）
- 平均年収 ${toManYen(latest?.average_annual_salary)}、平均年齢 ${latest?.average_age ?? "—"} 歳、平均勤続 ${latest?.average_tenure_years ?? "—"} 年、従業員 ${formatNumber(latest?.employee_count)} 人
- 数値の特徴を踏まえ、読者が在籍することの実利（賃金水準・教育機会・安定性等）を地の文で。箇条書き禁止。

【パート 3：キャリアパス】（h3「キャリアパスの広がり」、地の文 200〜350 字）
- 同社の規模感・業種から想定されるキャリアの広がりを段落形式で。箇条書き禁止。
- ジョブローテーション・専門職化・関連会社や海外展開などに触れてよい（同社のサマリで触れられている範囲で）。

3 つの h3 と各パラグラフを、HTML（<h3> と <p> のみ）で続けて返してください。
**重要：見出しは必ず <h3> を使い、<h1> や <h2> は出力しないこと。**
このセクションの大見出しは外側で <h2> として既に出力されているため、内側で <h2> を使うと見出しが二重になります。`;

  const r = await callOpenAi({
    model,
    system: BASE_SYSTEM,
    user: userPrompt,
    maxOutputTokens: 1800,
  });
  if (!r.ok) return r;

  const html = `<h2>${escapeHtml(c.name)} について</h2>\n${r.content}`;
  return { html, usage: r.usage };
}

async function genAverageSalary(
  ctx: SalaryArticleContext,
  model: AiModelId
): Promise<GenerateResult | { ok: false; error: string }> {
  const { company, history, industry_averages } = ctx;
  const last5 = history.slice(0, 5).reverse();

  // 5 年表（最新年度行の平均年収セルを蛍光ペンで強調）
  const latestYear = history[0]?.fiscal_year ?? null;
  const tableRows = last5
    .map((m) => {
      const ia = industry_averages.find(
        (a) => a.fiscal_year === m.fiscal_year
      );
      const isLatest = latestYear != null && m.fiscal_year === latestYear;
      const salaryCell = toManYen(m.average_annual_salary);
      return `<tr>
  <td>${m.fiscal_year} 年度</td>
  <td>${isLatest ? markText(salaryCell) : salaryCell}</td>
  <td>${m.average_age != null ? `${m.average_age} 歳` : "—"}</td>
  <td>${formatNumber(m.employee_count)} 人</td>
  <td>${ia ? toManYen(ia.avg_annual_salary) : "—"}</td>
</tr>`;
    })
    .join("");
  const tableHtml = `<table>
  <thead>
    <tr><th>年度</th><th>平均年収</th><th>平均年齢</th><th>従業員数</th><th>業界平均</th></tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>`;

  const userPrompt = `${company.name} の以下の経年データから、平均年収の動向を読み解く解釈段落を 2〜3 段落（合計 350〜550 字）で書いてください。

経年データ:
${last5
  .map(
    (m) =>
      `- ${m.fiscal_year} 年度: 年収 ${toManYen(
        m.average_annual_salary
      )} / 平均年齢 ${m.average_age ?? "—"} 歳 / 従業員 ${formatNumber(
        m.employee_count
      )} 人`
  )
  .join("\n")}

業界平均（最新年度）: ${
    industry_averages[0]
      ? toManYen(industry_averages[0].avg_annual_salary)
      : "—"
  }

ポイント:
- 直近の伸び（または減少）の幅を金額で示す
- 業界平均との差分を金額で 1 度出す
- 平均年齢の変化があれば、年収との関係を一言添える
- 因果関係は断定せず、観察として書く

<p> タグで段落分けした HTML を返してください。見出し（<h2> や <h3>）は付けない。`;

  const r = await callOpenAi({
    model,
    system: BASE_SYSTEM,
    user: userPrompt,
    maxOutputTokens: 1200,
  });
  if (!r.ok) return r;

  const html = `<h2>${escapeHtml(company.name)} の平均年収</h2>
${tableHtml}
${r.content}`;
  return { html, usage: r.usage };
}

async function genYoyPerformance(
  ctx: SalaryArticleContext,
  model: AiModelId
): Promise<GenerateResult | { ok: false; error: string }> {
  const { company, history } = ctx;
  const last5 = history.slice(0, 5).reverse();

  const rows = last5
    .map(
      (m) => `<tr>
  <td>${m.fiscal_year} 年度</td>
  <td>${toManYen(m.average_annual_salary)}</td>
  <td>${toBigYen(m.revenue)}</td>
  <td>${toBigYen(m.operating_income)}</td>
  <td>${toBigYen(m.net_income)}</td>
</tr>`
    )
    .join("");
  const tableHtml = `<table>
  <thead>
    <tr><th>年度</th><th>平均年収</th><th>売上</th><th>営業利益</th><th>純利益</th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;

  const userPrompt = `${company.name} の経年データから、業績と平均年収の関係を 2〜3 段落（合計 300〜500 字）で読み解いてください。

データ:
${last5
  .map(
    (m) =>
      `- ${m.fiscal_year}: 年収 ${toManYen(
        m.average_annual_salary
      )} / 売上 ${toBigYen(m.revenue)} / 営業利益 ${toBigYen(
        m.operating_income
      )} / 純利益 ${toBigYen(m.net_income)}`
  )
  .join("\n")}

ポイント:
- 売上や営業利益の動きと、平均年収の動きが連動しているかどうかを観察として記述
- 連動していない場合は「業績と賃金は短期では一致しない」点に触れる
- 因果関係は断定しない（観察にとどめる）

<p> タグの段落のみで返してください。見出しは付けない。`;

  const r = await callOpenAi({
    model,
    system: BASE_SYSTEM,
    user: userPrompt,
    maxOutputTokens: 1100,
  });
  if (!r.ok) return r;

  const html = `<h2>業績と年収の関係</h2>\n${tableHtml}\n${r.content}`;
  return { html, usage: r.usage };
}

async function genPeerComparison(
  ctx: SalaryArticleContext,
  model: AiModelId
): Promise<GenerateResult | { ok: false; error: string }> {
  const { company, peers } = ctx;
  if (peers.length === 0) {
    return {
      html: `<h2>同業他社との比較</h2><p>同業界の比較データを準備中です。</p>`,
      usage: ZERO_USAGE,
    };
  }
  const top = [...peers].sort(
    (a, b) => (b.latest_avg_salary ?? -1) - (a.latest_avg_salary ?? -1)
  );
  const selfIdx = top.findIndex((p) => p.id === company.id);
  const rows = top
    .map((p, i) => {
      const isSelf = p.id === company.id;
      return `<tr${isSelf ? ' style="background: #fff7ed;"' : ""}>
  <td>${i + 1}</td>
  <td>${
    isSelf
      ? `<strong>${escapeHtml(p.name)}</strong>`
      : `<a href="/companies/${escapeHtml(p.edinet_code)}">${escapeHtml(p.name)}</a>`
  }</td>
  <td>${toManYen(p.latest_avg_salary)}</td>
  <td>${formatNumber(p.latest_employee_count)} 人</td>
</tr>`;
    })
    .join("");
  const tableHtml = `<table>
  <thead>
    <tr><th>順位</th><th>会社名</th><th>平均年収</th><th>従業員数</th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;

  const peerListForAi = top
    .map(
      (p, i) =>
        `${i + 1}位: ${p.name}（年収 ${toManYen(p.latest_avg_salary)}, 従業員 ${formatNumber(p.latest_employee_count)} 人）`
    )
    .join("\n");

  const userPrompt = `${company.name}（順位 ${
    selfIdx + 1
  }/${top.length} 社）が同業界（${
    company.industry_name ?? "—"
  }）の中で占める位置を、2 段落（合計 300〜450 字）で読み解いてください。

ランキング:
${peerListForAi}

ポイント:
- 上位社との金額差を 1 つ具体的に
- ${company.name} の従業員規模が、年収の高低に影響している可能性に触れてよい（断定しない）
- 「上位約 X%」のような表現を 1 度入れる

<p> タグの段落のみ。見出しは不要。`;

  const r = await callOpenAi({
    model,
    system: BASE_SYSTEM,
    user: userPrompt,
    maxOutputTokens: 1000,
  });
  if (!r.ok) return r;

  const html = `<h2>同業他社との比較</h2>\n${tableHtml}\n${r.content}`;
  return { html, usage: r.usage };
}

async function genGenderDiversity(
  ctx: SalaryArticleContext,
  model: AiModelId
): Promise<GenerateResult | { ok: false; error: string }> {
  const { company, history, industry_averages } = ctx;
  const latest = history[0];
  const ia = industry_averages.find(
    (a) => latest && a.fiscal_year === latest.fiscal_year
  );

  const fmRatio = latest?.female_manager_ratio;
  const fmRatioInd = ia?.avg_female_manager_ratio;

  const userPrompt = `${company.name} の多様性指標を 2 段落（合計 200〜350 字）で読み解いてください。

データ:
- 女性管理職比率: ${fmRatio != null ? `${fmRatio.toFixed(1)}%` : "未公表"}
- 業界平均: ${fmRatioInd != null ? `${fmRatioInd.toFixed(1)}%` : "—"}
- 平均勤続年数: ${latest?.average_tenure_years ?? "—"} 年

ポイント:
- 業界平均との差を 1 度示す
- データが「未公表」「未取得」の場合は、その旨を率直に記す（捏造禁止）
- 因果関係は断定しない

<p> タグの段落のみ。`;

  const r = await callOpenAi({
    model,
    system: BASE_SYSTEM,
    user: userPrompt,
    maxOutputTokens: 800,
  });
  if (!r.ok) return r;

  const html = `<h2>男女別の年収・多様性</h2>\n${r.content}`;
  return { html, usage: r.usage };
}

async function genPersonaGuide(
  ctx: SalaryArticleContext,
  model: AiModelId
): Promise<GenerateResult | { ok: false; error: string }> {
  const c = ctx.company;
  const latest = ctx.history[0];

  const userPrompt = `${c.name} に関心を持つ 3 ペルソナへ向けたガイドを書きます。

【数値の前提】
- 平均年収: ${toManYen(latest?.average_annual_salary)}
- 平均年齢: ${latest?.average_age ?? "—"} 歳
- 業種: ${c.industry_name ?? "—"}
- 従業員数: ${formatNumber(latest?.employee_count)} 人

3 つの h3 を立てて、それぞれ地の文 200〜300 字で書いてください。箇条書き禁止。

1. <h3>転職を検討中の方へ</h3>
   想定オファー水準・交渉のヒント。同社の年齢別年収の目安に触れる。

2. <h3>就活生の方へ</h3>
   初任給・将来の年収カーブ・配属やキャリアの可能性に触れる。

3. <h3>現職社員の方へ</h3>
   業界中央値との比較から見える市場価値、外部評価の目線を提供。

各セクションは <h3> と <p> のみで構成。`;

  const r = await callOpenAi({
    model,
    system: BASE_SYSTEM,
    user: userPrompt,
    maxOutputTokens: 1500,
  });
  if (!r.ok) return r;

  const html = `<h2>あなたの立場で読み解く</h2>\n${r.content}`;
  return { html, usage: r.usage };
}

async function genFaq(
  ctx: SalaryArticleContext,
  model: AiModelId
): Promise<GenerateResult | { ok: false; error: string }> {
  const c = ctx.company;
  const latest = ctx.history[0];

  const userPrompt = `${c.name} の年収に関する FAQ を 12 問構成で書いてください。

【数値の前提】
- 平均年収: ${toManYen(latest?.average_annual_salary)}
- 平均年齢: ${latest?.average_age ?? "—"} 歳
- 業界: ${c.industry_name ?? "—"}
- 従業員: ${formatNumber(latest?.employee_count)} 人

各問の質問は読者目線の自然な日本語で。回答は 60〜120 字、複数文 OK。
**出力形式は厳密に次の構造**で、各問を <details> でアコーディオン化してください:

<details class="faq-item">
  <summary>{質問}</summary>
  <p>{回答}</p>
</details>

12 個の <details> を続けて並べてください。<details> の外側に <div class="faq-section"> でラップしてください。
他のタグ（<h2>, <h3>, <ul> 等）や前置き文・コードフェンスは禁止。

含めて欲しい質問テーマ:
- ${c.name} の平均年収は？
- 業界平均と比べて？
- 5 年前と比較してどう変わった？
- 20 代の年収は？
- 30 代の年収は？
- 40 代の年収は？
- 残業時間は？
- 女性管理職比率は？
- 福利厚生の特徴は？
- 中途採用の年収交渉のポイントは？
- 同業他社と比べて高い？
- 今後の見通しは？`;

  const r = await callOpenAi({
    model,
    system: BASE_SYSTEM,
    user: userPrompt,
    maxOutputTokens: 3500,
  });
  if (!r.ok) return r;

  // AI が <div class="faq-section"> でラップしていない場合に補正
  const trimmed = r.content.trim();
  const wrapped = trimmed.startsWith("<div")
    ? trimmed
    : `<div class="faq-section" data-type="faq-section">\n${trimmed}\n</div>`;

  const html = `<h2>よくある質問（FAQ）</h2>\n${wrapped}`;
  return { html, usage: r.usage };
}

// =====================================================================
// 年代別の推定年収（§4.5）
// =====================================================================

async function genAgeSalary(
  ctx: SalaryArticleContext,
  model: AiModelId
): Promise<GenerateResult | { ok: false; error: string }> {
  const { company, history } = ctx;
  const latest = history[0];
  const avg = latest?.average_annual_salary ?? null;

  if (avg == null) {
    return {
      html: `<h2>年代別の推定年収</h2>
<p>${escapeHtml(company.name)} の平均年収が未取得のため、年代別の推計値を出すことができません。</p>`,
      usage: ZERO_USAGE,
    };
  }

  const result = estimateAgeSalary({
    companyAvgAnnualYen: avg,
    industryName: company.industry_name,
  });
  if (!result) {
    return {
      html: `<h2>年代別の推定年収</h2>
<p>推計に必要なデータが揃わなかったため、出力できませんでした。</p>`,
      usage: ZERO_USAGE,
    };
  }

  const displayRows = result.rows.filter((r) =>
    result.display_age_classes.includes(r.age_class)
  );

  // 表
  const tableRows = displayRows
    .map(
      (r) => `<tr>
  <td>${escapeHtml(r.age_label)}</td>
  <td>${toManYen(r.estimated_annual_yen)}</td>
  <td>${r.census_monthly_kjpy.toFixed(1)} 千円</td>
  <td>${r.ratio.toFixed(2)}x</td>
</tr>`
    )
    .join("");
  const tableHtml = `<table>
  <thead>
    <tr>
      <th>年代</th>
      <th>推定年収（${escapeHtml(company.name)}）</th>
      <th>業界月給（${escapeHtml(result.industry_label)}）</th>
      <th>年齢計比</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>`;

  // AI 解釈段落
  const interpretRows = displayRows
    .map((r) => `${r.age_label}: ${toManYen(r.estimated_annual_yen)}`)
    .join(" / ");
  const userPrompt = `${company.name}（${
    company.industry_name ?? "—"
  }）の年代別推定年収について、自然な日本語で 2 段落（合計 250〜400 字）の解釈を書いてください。

推計値:
${interpretRows}

平均年収: ${toManYen(avg)}（平均年齢 ${latest?.average_age ?? "—"} 歳）
業界カーブ: ${result.industry_label}

ポイント:
- 「20 代と 50 代でいくら違うか」を具体的な金額で 1 度示す
- 推計値であることに 1 度触れる（「業界の年齢別賃金カーブから推計」など）
- 因果や断定は避ける（「と推測されます」「と見立てられます」）

<p> タグの段落のみ返してください。見出しは付けない。`;

  const r = await callOpenAi({
    model,
    system: BASE_SYSTEM,
    user: userPrompt,
    maxOutputTokens: 900,
  });
  if (!r.ok) return r;

  const noteHtml =
    result.notes.length > 0
      ? `<p><em>${result.notes.map((n) => escapeHtml(n)).join(" / ")}</em></p>`
      : "";

  const html = wrapMemberOnly(`<h2>年代別の推定年収</h2>
${tableHtml}
${r.content}
<p><em>※ ${escapeHtml(
    company.name
  )} の実際の平均年収（${toManYen(avg)}）に、${escapeHtml(
    result.industry_label
  )}の年齢別賃金カーブ（賃金構造基本統計調査 令和7年 第５-１表）から得られる年齢計に対する倍率を乗算した推計値です。実際の各年代の年収は職種・等級・地域で大きく変動します。</em></p>
${noteHtml}`);

  return { html, usage: r.usage };
}

// =====================================================================
// 役職別の推定年収（§4.6）
// =====================================================================

async function genRoleSalary(
  ctx: SalaryArticleContext,
  model: AiModelId
): Promise<GenerateResult | { ok: false; error: string }> {
  const { company, history } = ctx;
  const avg = history[0]?.average_annual_salary ?? null;

  if (avg == null) {
    return {
      html: `<h2>役職別の推定年収</h2>
<p>${escapeHtml(company.name)} の平均年収が未取得のため、役職別の推計値を出すことができません。</p>`,
      usage: ZERO_USAGE,
    };
  }

  const result = estimateRoleSalary({ companyAvgAnnualYen: avg });
  if (!result) {
    return {
      html: `<h2>役職別の推定年収</h2>
<p>推計に必要なデータが揃わなかったため、出力できませんでした。</p>`,
      usage: ZERO_USAGE,
    };
  }

  const tableRows = result.rows
    .map(
      (r) => `<tr>
  <td>${escapeHtml(r.label)}</td>
  <td>${toManYen(r.estimated_annual_yen)}</td>
  <td>${r.avg_age.toFixed(1)} 歳</td>
  <td>${r.tenure.toFixed(1)} 年</td>
  <td>${r.ratio.toFixed(2)}x</td>
</tr>`
    )
    .join("");
  const tableHtml = `<table>
  <thead>
    <tr>
      <th>役職</th>
      <th>推定年収（${escapeHtml(company.name)}）</th>
      <th>想定平均年齢</th>
      <th>想定平均勤続</th>
      <th>加重平均比</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>`;

  const interpretLines = result.rows
    .map((r) => `${r.label}: ${toManYen(r.estimated_annual_yen)}`)
    .join(" / ");
  const userPrompt = `${company.name} の役職別推定年収を、2 段落（合計 250〜400 字）で解釈してください。

推計値: ${interpretLines}
平均年収: ${toManYen(avg)}

ポイント:
- 部長級と非役職者の差を具体的な金額で 1 度示す
- 「課長級になると年収が一段階上がる」のような典型ライフイベントの目安として書く
- 推計であること（厚生労働省「役職別賃金（令和7年度）」の月給比から逆算）に 1 度触れる
- 因果は断定しない

<p> 段落のみ。見出しは不要。`;

  const r = await callOpenAi({
    model,
    system: BASE_SYSTEM,
    user: userPrompt,
    maxOutputTokens: 900,
  });
  if (!r.ok) return r;

  const noteHtml =
    result.notes.length > 0
      ? `<p><em>${result.notes.map((n) => escapeHtml(n)).join(" / ")}</em></p>`
      : "";

  const html = wrapMemberOnly(`<h2>役職別の推定年収</h2>
${tableHtml}
${r.content}
${noteHtml}`);

  return { html, usage: r.usage };
}

// =====================================================================
// 生涯年収（§4.6.5）
// =====================================================================

async function genLifetimeEarnings(
  ctx: SalaryArticleContext,
  model: AiModelId
): Promise<GenerateResult | { ok: false; error: string }> {
  const { company, history } = ctx;
  const avg = history[0]?.average_annual_salary ?? null;

  if (avg == null) {
    return {
      html: `<h2>生涯年収（${escapeHtml(company.name)}）</h2>
<p>${escapeHtml(company.name)} の平均年収が未取得のため、生涯年収を試算できません。</p>`,
      usage: ZERO_USAGE,
    };
  }

  const result = estimateLifetimeEarnings({
    companyAvgAnnualYen: avg,
    industryName: company.industry_name,
  });
  if (!result) {
    return {
      html: `<h2>生涯年収（${escapeHtml(company.name)}）</h2>
<p>試算に必要なデータが揃わなかったため、出力できませんでした。</p>`,
      usage: ZERO_USAGE,
    };
  }

  const breakdownRows = result.breakdown
    .map(
      (b) => `<tr>
  <td>${escapeHtml(b.age_label)}</td>
  <td>${b.years} 年</td>
  <td>${toManYen(b.annual_yen)}</td>
  <td>${toManYen(b.subtotal_yen)}</td>
</tr>`
    )
    .join("");
  // 「生涯年収」合計セルを蛍光ペンで強調。
  // class で行に意味付けし、エディタ・公開ページの CSS から色を当てる。
  const summaryRow = `<tr class="row-subtotal">
  <td><strong>在職中合計</strong></td>
  <td>—</td>
  <td>—</td>
  <td><strong>${toManYen(result.working_total_yen)}</strong></td>
</tr>
<tr class="row-estimate">
  <td>退職金推計</td>
  <td>—</td>
  <td>—</td>
  <td>${toManYen(result.retirement_yen)}</td>
</tr>
<tr class="row-grand-total">
  <td><strong>生涯年収</strong></td>
  <td>—</td>
  <td>—</td>
  <td>${markText(`<strong>${toManYen(result.grand_total_yen)}</strong>`)}</td>
</tr>`;

  const tableHtml = `<table>
  <thead>
    <tr>
      <th>年代</th>
      <th>年数</th>
      <th>推定年収</th>
      <th>小計</th>
    </tr>
  </thead>
  <tbody>${breakdownRows}${summaryRow}</tbody>
</table>`;

  const userPrompt = `${company.name} の生涯年収試算（学卒〜60歳定年・勤続38年）について、2 段落（合計 250〜400 字）で解説してください。

試算値:
- 在職中合計: ${toManYen(result.working_total_yen)}
- 退職金推計: ${toManYen(result.retirement_yen)}
- 生涯年収（合計）: ${toManYen(result.grand_total_yen)}
平均年収（${history[0]?.fiscal_year ?? "最新年度"}）: ${toManYen(avg)}

ポイント:
- 同社一貫キャリアの理想シナリオである旨を 1 度明示
- 退職金が平均年収の 2.5 倍として算入されている旨に触れる（経験則）
- 同業の比較に踏み込みすぎない（情報過多になる）

<p> 段落のみ返す。見出しは不要。`;

  const r = await callOpenAi({
    model,
    system: BASE_SYSTEM,
    user: userPrompt,
    maxOutputTokens: 900,
  });
  if (!r.ok) return r;

  const noteHtml = `<p><em>${result.notes
    .map((n) => escapeHtml(n))
    .join(" / ")}</em></p>`;

  const html = wrapMemberOnly(`<h2>生涯年収（${escapeHtml(company.name)}）</h2>
${tableHtml}
${r.content}
${noteHtml}`);

  return { html, usage: r.usage };
}

// =====================================================================
// 初任給・賞与・手取り（§4.7）
// 手取り → 累進税 + 社会保険で計算実装。
// 初任給・賞与 → 公式採用 HP 誘導のプレースホルダ。
// =====================================================================

function genCompensation(ctx: SalaryArticleContext): GenerateResult {
  const { company, history } = ctx;
  const latest = history[0];
  const avg = latest?.average_annual_salary ?? null;
  const avgAge = latest?.average_age != null ? Math.round(Number(latest.average_age)) : 35;

  // 公式採用 HP の参照リンク（website_url が無ければ汎用文に）
  const recruitLink = company.website_url
    ? `<a href="${escapeHtml(
        company.website_url
      )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        company.name
      )}の公式サイト</a>`
    : `${escapeHtml(company.name)}の公式採用情報`;

  // ===== 初任給（プレースホルダ） =====
  const startingSalaryHtml = `<h3>初任給</h3>
<p>初任給は学歴・職種・勤務地・配属部門で大きく異なるため、本記事では金額を記載していません。最新の確定値は <strong>${recruitLink}</strong> の採用情報をご確認ください。</p>`;

  // ===== 賞与（プレースホルダ） =====
  const bonusHtml = `<h3>賞与（ボーナス）</h3>
<p>${escapeHtml(
    company.name
  )} の賞与（年間支給月数）は労使交渉で年度ごとに変動するため、本記事では推計値を記載していません。最新の妥結結果は <strong>${recruitLink}</strong> の採用情報・IR 資料・有価証券報告書をご確認ください。</p>`;

  // ===== 手取り：本実装（計算ロジック） =====
  let takeHomeHtml: string;
  if (avg == null) {
    takeHomeHtml = `<h3>手取り（額面 → 手取りの試算）</h3>
<p>${escapeHtml(
      company.name
    )} の平均年収が未取得のため、手取りの試算を出すことができません。</p>`;
  } else {
    // 自社平均年収での手取り
    const own = estimateTakeHome(avg, avgAge);
    // 参考表（300万・400万・500万・700万・1000万・1500万）
    const ref = estimateTakeHomeReferenceTable(avgAge);

    const ownRow = own
      ? `<tr style="background: #fff7ed;">
  <td><strong>${escapeHtml(company.name)} 平均</strong></td>
  <td>${toManYen(own.gross_yen)}</td>
  <td>${toManYen(own.social_insurance_yen)}</td>
  <td>${toManYen(own.income_tax_yen)}</td>
  <td>${toManYen(own.resident_tax_yen)}</td>
  <td><strong>${toManYen(own.take_home_yen)}</strong></td>
  <td>${(own.take_home_rate * 100).toFixed(1)}%</td>
</tr>`
      : "";

    const refRows = ref
      .map(
        (r) => `<tr>
  <td>${toManYen(r.gross_yen)}</td>
  <td>${toManYen(r.gross_yen)}</td>
  <td>${toManYen(r.social_insurance_yen)}</td>
  <td>${toManYen(r.income_tax_yen)}</td>
  <td>${toManYen(r.resident_tax_yen)}</td>
  <td>${toManYen(r.take_home_yen)}</td>
  <td>${(r.take_home_rate * 100).toFixed(1)}%</td>
</tr>`
      )
      .join("");

    const tableHtml = `<table>
  <thead>
    <tr>
      <th>区分</th>
      <th>額面年収</th>
      <th>社会保険料</th>
      <th>所得税</th>
      <th>住民税</th>
      <th>手取り年収</th>
      <th>手取り率</th>
    </tr>
  </thead>
  <tbody>
    ${ownRow}
    ${refRows}
  </tbody>
</table>`;

    const ownSummary = own
      ? `<p>${escapeHtml(company.name)} の平均年収 ${toManYen(
          own.gross_yen
        )} を額面とした場合、社会保険料・所得税・住民税を差し引いた手取りはおよそ <strong>${toManYen(
          own.take_home_yen
        )}</strong>（手取り率 ${(own.take_home_rate * 100).toFixed(
          1
        )}%）。月あたりに按分すると <strong>${toManYen(
          own.monthly_take_home_yen
        )}</strong> です。実際は配偶者控除・扶養控除・住宅ローン控除・iDeCo・ふるさと納税などで増減します。</p>`
      : "";

    takeHomeHtml = `<h3>手取り（額面 → 手取りの試算）</h3>
${ownSummary}
${tableHtml}
<p><em>※ 給与所得控除・社会保険料率（健康保険 + 厚生年金 + 雇用保険、40〜64 歳は介護保険込み）・所得税の累進税率（復興特別所得税込み）・住民税 10%（均等割 5,000 円）から概算した試算値です。配偶者控除・扶養控除・各種特別控除や、賞与の月次按分、都道府県固有の住民税差は考慮していません。</em></p>`;
  }

  const html = `<h2>初任給・賞与・手取り</h2>
${startingSalaryHtml}
${bonusHtml}
${wrapMemberOnly(takeHomeHtml)}`;

  return { html, usage: ZERO_USAGE };
}

// =====================================================================
// ディスパッチャ
// =====================================================================

export async function generateSection(args: {
  sectionId: string;
  ctx: SalaryArticleContext;
  model: AiModelId;
}): Promise<{ ok: true; data: GenerateResult } | { ok: false; error: string }> {
  const { sectionId, ctx, model } = args;
  try {
    switch (sectionId) {
      case "4.0":
        return { ok: true, data: genHeader(ctx) };
      case "4.1": {
        const r = await genHero(ctx, model);
        if ("ok" in r && r.ok === false) return r;
        return { ok: true, data: r as GenerateResult };
      }
      case "4.2":
        return { ok: true, data: genEntityPanel(ctx) };
      case "4.3": {
        const r = await genAboutCompany(ctx, model);
        if ("ok" in r && r.ok === false) return r;
        return { ok: true, data: r as GenerateResult };
      }
      case "4.4": {
        const r = await genAverageSalary(ctx, model);
        if ("ok" in r && r.ok === false) return r;
        return { ok: true, data: r as GenerateResult };
      }
      case "4.5": {
        const r = await genAgeSalary(ctx, model);
        if ("ok" in r && r.ok === false) return r;
        return { ok: true, data: r as GenerateResult };
      }
      case "4.6": {
        const r = await genRoleSalary(ctx, model);
        if ("ok" in r && r.ok === false) return r;
        return { ok: true, data: r as GenerateResult };
      }
      case "4.6.5": {
        const r = await genLifetimeEarnings(ctx, model);
        if ("ok" in r && r.ok === false) return r;
        return { ok: true, data: r as GenerateResult };
      }
      case "4.7":
        return { ok: true, data: genCompensation(ctx) };
      case "4.8": {
        const r = await genGenderDiversity(ctx, model);
        if ("ok" in r && r.ok === false) return r;
        return { ok: true, data: r as GenerateResult };
      }
      case "4.9": {
        const r = await genYoyPerformance(ctx, model);
        if ("ok" in r && r.ok === false) return r;
        return { ok: true, data: r as GenerateResult };
      }
      case "4.10": {
        const r = await genPeerComparison(ctx, model);
        if ("ok" in r && r.ok === false) return r;
        return { ok: true, data: r as GenerateResult };
      }
      case "4.11": {
        const r = await genPersonaGuide(ctx, model);
        if ("ok" in r && r.ok === false) return r;
        return { ok: true, data: r as GenerateResult };
      }
      case "4.12": {
        const r = await genFaq(ctx, model);
        if ("ok" in r && r.ok === false) return r;
        return { ok: true, data: r as GenerateResult };
      }
      case "4.13":
        return { ok: true, data: genSources(ctx) };
      default:
        return { ok: false, error: `未知のセクション: ${sectionId}` };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? String(e) };
  }
}

// =====================================================================
// タイトル生成（決定論的・SEO 固定パターン）
// =====================================================================

/**
 * 全角文字を 1.0、半角文字を 0.5 として概算長を返す（SERP 表示の目安）。
 */
function visualLength(s: string): number {
  let n = 0;
  for (const ch of s) {
    n += /[\x00-\x7F]/.test(ch) ? 0.5 : 1;
  }
  return n;
}

export type SalaryTitleResult = {
  title: string;
  /** 視覚長（全角=1, 半角=0.5）。SERP の表示枠の参考値（32 字超で末尾省略の目安） */
  visual_length: number;
  /** どのフォールバックを採用したか */
  pattern: "fixed_with_avg" | "fixed_without_avg";
  /** 社名が極端に長く切詰めた場合 true */
  truncated_name: boolean;
};

/**
 * 固定タイトルパターン（運用方針）
 *   平均年収あり: 「{社名}の平均年収は{XX}万円！年代別年収や役職別年収・手取り推計情報【{YYYY}年最新】」
 *   平均年収なし: 「{社名}の年収は？年代別年収や役職別年収・手取り推計情報【{YYYY}年最新】」
 *
 * - パターンは固定。SERP 表示枠（全角 32 字目安）は超過しうるが、固定構造を優先する方針
 * - 年（{YYYY}）は最新の有報年度（当年/前年なら）または当年を採用
 * - 社名が長すぎて全体が 60 字を超える場合のみ、社名を末尾「…」で切詰める安全網
 */
const TITLE_HARD_CAP = 60; // 異常に長い社名のみ切詰める

export function buildSalaryTitle(ctx: SalaryArticleContext): SalaryTitleResult {
  const { company, history } = ctx;
  const latest = history[0];
  const avgYen = latest?.average_annual_salary ?? null;
  const fiscalYear = latest?.fiscal_year ?? null;

  // 「最新」表記用の年：直近データが当年/前年なら fiscal_year、それより古ければ当年
  const now = new Date();
  const currentYear = now.getFullYear();
  const year =
    fiscalYear != null && fiscalYear >= currentYear - 1
      ? fiscalYear
      : currentYear;

  const avgMan =
    avgYen != null && Number.isFinite(avgYen)
      ? Math.round(avgYen / 10000)
      : null;

  const buildWithName = (n: string): string => {
    if (avgMan != null) {
      return `${n}の平均年収は${avgMan}万円！年代別年収や役職別年収・手取り推計情報【${year}年最新】`;
    }
    return `${n}の年収は？年代別年収や役職別年収・手取り推計情報【${year}年最新】`;
  };

  const truncate = (s: string, cap: number) => {
    let acc = "";
    let used = 0;
    for (const ch of s) {
      const w = /[\x00-\x7F]/.test(ch) ? 0.5 : 1;
      if (used + w > cap) break;
      acc += ch;
      used += w;
    }
    return acc;
  };

  let title = buildWithName(company.name);
  let truncated = false;
  if (visualLength(title) > TITLE_HARD_CAP) {
    // 社名以外の固定部分の長さを差し引いて、残り枠に社名を収める
    const fixed = buildWithName("");
    const room = TITLE_HARD_CAP - visualLength(fixed) - 1; // "…" 分
    const cut = truncate(company.name, Math.max(room, 4));
    title = buildWithName(`${cut}…`);
    truncated = true;
  }

  return {
    title,
    visual_length: visualLength(title),
    pattern: avgMan != null ? "fixed_with_avg" : "fixed_without_avg",
    truncated_name: truncated,
  };
}
