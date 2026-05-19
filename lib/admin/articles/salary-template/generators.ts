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

/**
 * toBigYen の整数丸め版。§4.9（業績と年収の関係）など、
 * 「12 億円」「3,500 万円」のように小数点を出さないで欲しい場面で使う。
 */
function toBigYenInt(yen: number | null | undefined): string {
  if (yen == null || !Number.isFinite(yen)) return "—";
  if (Math.abs(yen) >= 1_0000_0000)
    return `${Math.round(yen / 1_0000_0000).toLocaleString("ja-JP")} 億円`;
  if (Math.abs(yen) >= 10000)
    return `${Math.round(yen / 10000).toLocaleString("ja-JP")} 万円`;
  return `${Math.round(yen).toLocaleString("ja-JP")} 円`;
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

/**
 * 代表者文字列の正規化。
 *
 * XBRL 由来の `companies.representative` は「代表取締役社長 山田 太郎」「山田 太郎
 * 代表取締役社長」「山田 太郎（代表取締役社長）」など揺れがあるので、
 * 肩書きと前後の空白・括弧書きを除去して氏名だけを残す。
 * 氏名内の姓名間スペースは保持する（"山田 太郎" などの自然表記）。
 *
 * 一致した肩書きが無ければ trim だけして返す。
 */
function cleanRepresentative(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).replace(/[　\s]+/gu, " ").trim();
  if (!s) return null;

  // 末尾のカッコ書き（"山田 太郎（代表取締役社長）"）を剥がす
  s = s.replace(/\s*[（(][^（()）]*[)）]$/u, "").trim();

  // 長い肩書きを優先してマッチさせるため長さ降順
  const titles = [
    "代表取締役社長兼CEO",
    "代表取締役会長兼CEO",
    "代表取締役副社長",
    "代表取締役社長",
    "代表取締役会長",
    "代表執行役社長",
    "代表執行役会長",
    "取締役副社長",
    "取締役社長",
    "取締役会長",
    "代表取締役",
    "代表執行役",
    "執行役員",
    "代表理事",
    "副会長",
    "副社長",
    "理事長",
    "取締役",
    "執行役",
    "社長",
    "会長",
    "CEO",
    "COO",
    "CFO",
  ].sort((a, b) => b.length - a.length);

  // 先頭の肩書きを剥がす（複数連続にも対応）
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of titles) {
      if (s.startsWith(t)) {
        s = s.slice(t.length).replace(/^[\s,、・／/]+/u, "").trim();
        changed = true;
        break;
      }
    }
  }
  // 末尾の肩書きを剥がす（複数連続にも対応）
  changed = true;
  while (changed) {
    changed = false;
    for (const t of titles) {
      if (s.endsWith(t)) {
        s = s.slice(0, -t.length).replace(/[\s,、・／/]+$/u, "").trim();
        changed = true;
        break;
      }
    }
  }
  return s || null;
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
    c.capital_stock_yen != null ? toBigYenInt(c.capital_stock_yen) : null;
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
      ? `${toBigYenInt(latest.revenue)}${fiscalYearTag}`
      : null;
  const operatingIncomeHtml: string | null =
    latest?.operating_income != null
      ? `${toBigYenInt(latest.operating_income)}${fiscalYearTag}`
      : null;
  const ordinaryIncomeHtml: string | null =
    latest?.ordinary_income != null
      ? `${toBigYenInt(latest.ordinary_income)}${fiscalYearTag}`
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
    [
      "代表者",
      (() => {
        const cleaned = cleanRepresentative(c.representative);
        return cleaned ? escapeHtml(cleaned) : null;
      })(),
    ],
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
  // 1 リクエストあたりの最大待ち時間。OpenAI が応答を返さずハングする現象が
  // たまにあるので、必ず AbortController で打ち切るようにしている。
  // FAQ セクション (§4.12) など max_output_tokens=3500 の長文生成は
  // gpt-4o-mini でも 60〜120 秒かかることがあるので、タイムアウトは
  // 余裕を持たせる必要がある。短すぎるとリトライ地獄に陥り体感が極端に遅くなる。
  const REQUEST_TIMEOUT_MS = 180_000;
  let lastErr = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: ac.signal,
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
      const err = e as Error;
      // AbortController で打ち切られたケースは判別しやすいメッセージに置き換える
      if (err.name === "AbortError" || /aborted/i.test(err.message ?? "")) {
        lastErr = `OpenAI request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`;
      } else {
        lastErr = err.message ?? String(err);
      }
      if (attempt < maxAttempts) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      return { ok: false, error: lastErr };
    } finally {
      clearTimeout(timer);
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

【絶対禁止：定性的事実の創作（最重要）】
本記事のデータソースは「有価証券報告書（EDINET）の財務指標と企業概要 summary」「賃金センサス」「役職別賃金」のみです。
プロンプト内の【数値の前提】や【会社サマリ】に明示されていない、以下のトピックは一切書かないこと:
- 研修制度／教育プログラム／資格取得支援／OJT／人材育成施策
- 福利厚生の具体名（育児休暇／産休制度／住宅手当／家族手当／社員寮／保養所／健康診断制度／退職金規程の内容）
- 海外展開／海外事業／海外駐在／海外赴任／グローバル人材／グローバル化／国際的な視野／国際的なキャリア
- ジョブローテーション／配属の幅／人事異動／キャリアパス制度／昇進ルート
- 残業時間／労働時間／有給取得率／フレックス／在宅勤務制度
- 初任給の金額／賞与の月数（〇か月）／退職金の額
- 組織風土／社風／企業文化／従業員エンゲージメント／心理的安全性
- ダイバーシティ／多様性／D&I／女性活躍 に紐づくあらゆる「取り組み・施策・活動・推進・促進・維持・向上・強化・支援」表現（言い換えても禁止。例:「多様性に関する取り組み」「多様性の維持や向上に向けた取り組み」「多様性に対する取り組み」も禁止）
- 「制度が充実している」「体制が整っている」「環境が整備されている」「取り組みが進んでいる」のような根拠のない肯定的評価
- 「業界平均を上回る／下回る」「高い水準／低い水準」「上位／下位」など、プロンプトで具体的な金額・順位・比率が示されていない場合の比較断定

例えば summary に「海外〇〇」と明記されていなければ「海外展開」と書かない。
summary に教育や研修への言及がなければ「研修制度」と書かない。
average_overtime_hours が示されていなければ「残業時間」を書かない。
迷ったら書かない。書ける根拠が無いと判断したら、その文ごと省略する。

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
- 「優れた技術力」「高い競争力」「業界トップクラス」「安定した職場環境」「魅力的な職場」「理想的なキャリア」など主観的賛辞`;

/**
 * 出力 HTML から「データ根拠が無いと推定される定性的事実」を検出して
 * warning ラベルとして返す。記事再生成のシグナル / 管理画面での目視確認用。
 *
 * @param html 生成された本文 HTML
 * @param allowList この記事のソース（summary 等）に元から存在する語。検出から除外する
 */
// 「業界平均を上回る／高い水準」「業界平均を下回る／低い水準」は数値データの方向と
// 一致していれば事実なので、ここでは無条件には弾かない（事実検証は generators 側で
// `diff` を AI プロンプトに渡すことで担保している）。検出する hyperbole は残す。
const HALLUCINATION_KEYWORDS: { keyword: RegExp; label: string }[] = [
  { keyword: /研修制度|教育制度|教育プログラム|研修プログラム|社員研修|研修体制|資格取得支援/, label: "研修制度" },
  { keyword: /海外展開|海外事業|海外駐在|海外赴任|海外サポート|グローバル展開|グローバル人材|グローバル化|国際的な視野|国際的なキャリア/, label: "海外展開" },
  { keyword: /ジョブローテーション|ジョブ・ローテーション|ローテーション制度/, label: "ジョブローテーション" },
  { keyword: /育児休暇|育休制度|産休制度|住宅手当|家族手当|社員寮|保養所|健康診断制度|フレックス制度|在宅勤務制度/, label: "福利厚生(具体)" },
  { keyword: /残業時間.{0,20}(時間|h)|月平均.{0,10}(時間|h).{0,10}残業|残業.{0,5}少なめ|残業.{0,5}多め/, label: "残業時間(具体)" },
  // 「多様性」「ダイバーシティ」「D&I」「女性活躍」+ (取り組み/施策/活動/推進/促進/維持/向上 等) は
  // すべて「社内施策の存在を推測している」と判定する。実際 §4.8 の貫通例:
  // 「多様性に関する取り組み」「多様性の維持や向上に向けた取り組み」「多様性に対する取り組み」
  { keyword: /(多様性|ダイバーシティ|D&I|女性活躍|女性の活躍).{0,30}(取り組み|取組|施策|活動|推進|促進|維持|向上|強化|拡大|支援|サポート)/, label: "ダイバーシティ施策" },
  { keyword: /安定した職場環境|魅力的な職場|理想的な職場|働きやすい職場環境|アットホーム/, label: "主観的賛辞" },
  // 数値の裏付け無しに使われがちな hyperbole のみ検出する
  { keyword: /業界トップクラス|業界をリード|業界の最高水準|圧倒的に高い水準|業界随一|国内有数の年収/, label: "根拠なき断定" },
];

export function detectHallucinations(html: string, allowList: string = ""): string[] {
  const warnings: string[] = [];
  for (const { keyword, label } of HALLUCINATION_KEYWORDS) {
    const m = html.match(keyword);
    if (!m) continue;
    // allowList（summary 等）に同じ語が含まれていれば「データ由来」とみなしスキップ
    if (allowList && new RegExp(m[0].slice(0, Math.min(m[0].length, 6))).test(allowList)) {
      continue;
    }
    warnings.push(`未根拠キーワード検出: ${label} ("${m[0].slice(0, 40)}")`);
  }
  return warnings;
}

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
  const summary = (c.summary ?? c.description ?? "").trim();
  const hasSummary = summary.length > 0;

  // 業界平均（最新年度）を在籍数値プロフィールに供給する。
  // これを渡さないと AI が「業界平均を上回る」と勝手に憶測してしまう（過去の事故）。
  const ia = ctx.industry_averages.find(
    (a) => latest && a.fiscal_year === latest.fiscal_year
  );
  const indAvg = ia?.avg_annual_salary ?? null;
  const indTenure = ia?.avg_tenure_years ?? null;
  const diff =
    indAvg != null && latest?.average_annual_salary != null
      ? latest.average_annual_salary - indAvg
      : null;
  const diffLabel =
    diff != null
      ? diff >= 0
        ? `業界平均より +${toManYen(diff)} 高い`
        : `業界平均より ${toManYen(diff)} 低い`
      : "業界平均との比較データなし";

  // パート 3 は summary に「事業領域」が書かれている時のみ AI に書かせる。
  // summary 由来でない人事制度・海外展開・ローテ等への言及は厳禁。
  const part3Block = hasSummary
    ? `

【パート 3：${c.name} の事業領域】（h3「${c.name} の事業領域」、地の文 200〜350 字、箇条書き禁止）
パート 1 の会社サマリに**明示的に書かれている事業・サービス・ブランド・拠点**だけを、別の角度から再構成してください。
- パート 1 と同じ事実を別表現で言い換える形で OK
- サマリに無い事業・地域・新規領域は一切書かない（推測禁止）
- 業績の数値（売上 ${toBigYenInt(latest?.revenue)}、営業利益 ${toBigYenInt(latest?.operating_income)}、従業員 ${formatNumber(latest?.employee_count)} 人）を 1 度織り込んでよい`
    : "";

  const part3Count = hasSummary ? "3" : "2";

  const userPrompt = `${c.name} について、${part3Count} つのパートを書いてください。
本記事のデータソースは「有価証券報告書（EDINET）の財務指標と企業概要 summary」のみです。
**summary に書かれていない定性的事実（研修制度・福利厚生・海外展開・ジョブローテーション・組織風土・人事施策など）は一切書かないこと。** 触れたい場合でも、データに無いものは黙って省略してください。

【パート 1：会社概要】（h3「${escapeHtml(c.name)} とは」、200〜300 字）
基礎情報:
- 業種: ${c.industry_name ?? "—"}
- 上場市場: ${c.listed_market ?? "—"}
- 本社: ${c.headquarters ?? "—"}
- 設立: ${c.founded_year ?? c.founded_at ?? "—"}

会社サマリ（このサマリに書かれている範囲だけを忠実に整理してください。サマリに無い事実を加えない）:
${hasSummary ? summary : "（取得できていません。汎用的な業界一般論ではなく、基礎情報の事実のみを淡々と書いてください）"}

【パート 2：${c.name} の数値プロフィール】（h3「${escapeHtml(c.name)} の数値プロフィール」、地の文 250〜400 字、箇条書き禁止）
以下の数値「だけ」を根拠に、読者が同社の社員構成と賃金水準を把握できる解説を書いてください:
- 平均年収: ${toManYen(latest?.average_annual_salary)}
- 平均年齢: ${latest?.average_age ?? "—"} 歳
- 平均勤続: ${latest?.average_tenure_years ?? "—"} 年（業界平均勤続: ${indTenure != null ? `${indTenure} 年` : "—"}）
- 従業員数: ${formatNumber(latest?.employee_count)} 人
- 業界平均年収: ${indAvg != null ? toManYen(indAvg) : "—"}（${diffLabel}）

【厳守】
- 業界平均との大小関係は、上で示した「${diffLabel}」と完全に一致させること（逆転は事実誤認になります）
- 「研修」「教育」「福利厚生」「海外」「ジョブローテ」「組織文化」「制度が充実」「環境が整っている」「安定した職場環境」など、データソースに無い定性的事実・主観評価は書かない
- 数値の意味（年代層が比較的若い／勤続が長め／業界平均との差）を、観察として書く（断定しない）${part3Block}

${part3Count} 個の h3 と各パラグラフを、HTML（<h3> と <p> のみ）で続けて返してください。
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
  const warnings = detectHallucinations(r.content, summary);
  return { html, usage: r.usage, warnings: warnings.length ? warnings : undefined };
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
  <td>${toBigYenInt(m.revenue)}</td>
  <td>${toBigYenInt(m.operating_income)}</td>
  <td>${toBigYenInt(m.net_income)}</td>
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
      )} / 売上 ${toBigYenInt(m.revenue)} / 営業利益 ${toBigYenInt(
        m.operating_income
      )} / 純利益 ${toBigYenInt(m.net_income)}`
  )
  .join("\n")}

ポイント:
- 売上や営業利益の動きと、平均年収の動きが連動しているかどうかを観察として記述
- 連動していない場合は「業績と賃金は短期では一致しない」点に触れる
- 因果関係は断定しない（観察にとどめる）
- 金額は与えられた整数表記（「○○億円」「○○万円」）のまま使い、小数点以下の桁を勝手に増やさない

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
  const { company, peers, peer_meta } = ctx;
  const totalInIndustry = peer_meta.total_in_industry;
  const selfRank = peer_meta.self_rank;

  if (peers.length === 0 || totalInIndustry === 0) {
    return {
      html: `<h2>同業他社との比較</h2><p>同業界の比較データを準備中です。</p>`,
      usage: ZERO_USAGE,
    };
  }

  // 実順位昇順で並べる（既にそうなっている想定だが念のため）
  const sorted = [...peers].sort((a, b) => a.rank - b.rank);

  // 表：実順位を表示。表示行間に順位の飛びがある場合は「…」行で区切る
  const tableRows: string[] = [];
  let prevRank = 0;
  for (const p of sorted) {
    if (prevRank > 0 && p.rank > prevRank + 1) {
      tableRows.push(
        `<tr><td colspan="4" style="text-align:center; color:#9ca3af;">…</td></tr>`
      );
    }
    const isSelf = p.id === company.id;
    tableRows.push(`<tr${isSelf ? ' style="background: #fff7ed;"' : ""}>
  <td>${p.rank}</td>
  <td>${
    isSelf
      ? `<strong>${escapeHtml(p.name)}</strong>`
      : `<a href="/companies/${escapeHtml(p.edinet_code)}">${escapeHtml(p.name)}</a>`
  }</td>
  <td>${toManYen(p.latest_avg_salary)}</td>
  <td>${formatNumber(p.latest_employee_count)} 人</td>
</tr>`);
    prevRank = p.rank;
  }
  const tableCaption = `<p class="table-caption">${escapeHtml(
    company.industry_name ?? "—"
  )} のうち平均年収を有価証券報告書に記載している ${totalInIndustry} 社${
    selfRank != null ? ` 中 ${selfRank} 位` : ""
  }${selfRank != null ? `（${escapeHtml(company.name)}）` : ""}</p>`;
  const tableHtml = `<table>
  <thead>
    <tr><th>順位</th><th>会社名</th><th>平均年収</th><th>従業員数</th></tr>
  </thead>
  <tbody>${tableRows.join("")}</tbody>
</table>
${tableCaption}`;

  // AI 用テキスト
  const peerListForAi = sorted
    .map(
      (p) =>
        `${p.rank}位: ${p.name}（年収 ${toManYen(p.latest_avg_salary)}, 従業員 ${formatNumber(p.latest_employee_count)} 人）`
    )
    .join("\n");

  const top1 = sorted[0];
  const selfFromList = sorted.find((p) => p.id === company.id);
  const gapToTop =
    selfFromList?.latest_avg_salary != null &&
    top1?.latest_avg_salary != null &&
    selfFromList.id !== top1.id
      ? top1.latest_avg_salary - selfFromList.latest_avg_salary
      : null;
  const percentile =
    selfRank != null && totalInIndustry > 0
      ? Math.round((selfRank / totalInIndustry) * 100)
      : null;

  const userPrompt = `${company.name} の同業界 ${
    company.industry_name ?? "—"
  } における平均年収の位置を、2 段落（合計 300〜450 字）で読み解いてください。

【データの範囲（重要）】
- 母数は「${company.industry_name ?? "—"} に分類されており、平均年収を有価証券報告書に記載している企業」
- その総数：${totalInIndustry} 社（自社含む）
- 業界全体の企業数ではなく、有報提出 + 開示企業の中の数値です
${selfRank != null ? `- ${company.name} の順位：${totalInIndustry} 社中 ${selfRank} 位` : `- ${company.name} は平均年収を未開示のため母数の対象外`}
${percentile != null ? `- 上位パーセンタイル：上位約 ${percentile}%` : ""}
${
  gapToTop != null
    ? `- 1 位 ${top1.name} の平均年収 ${toManYen(
        top1.latest_avg_salary
      )} との差：${toManYen(gapToTop)}`
    : ""
}

【上位ランキング（および ${company.name}）】
${peerListForAi}

【厳守事項】
- 「業界全体での順位」と「有報提出 + 平均年収開示企業内の順位」を絶対に混同しない
- 「最下位」「業界トップクラス」「業界の最低水準」など、データ範囲を超えた断定はしない
- 「同業界において」「業界内で」のような表現を使う場合は、必ず「（有報を提出して平均年収を開示している ${totalInIndustry} 社のうち）」のような注釈を一度添える
- 1 位企業との金額差を 1 度だけ具体的に書く
- 従業員規模が年収に影響している可能性は触れて良い（断定はしない）
- ${selfRank != null && percentile != null ? `「上位約 ${percentile}%」のような相対的位置を 1 度書いてよい` : "順位や上位 X% を断定しない"}

<p> タグの段落のみ。見出し（h2/h3）は不要。`;

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
- 業界平均との差を 1 度、観察として示す（差分は計算上の事実）
- データが「未公表」「未取得」の場合は、その旨を率直に記す（捏造禁止）
- 因果関係は断定しない

【厳守 — 書いてはいけないこと（最重要）】
- 「多様性」「ダイバーシティ」「D&I」「女性活躍」を主語にした **取り組み・施策・活動・推進・促進・維持・向上・強化・支援** など、社内活動の存在を示唆する記述はすべて禁止。
  - 例えば次のような言い換えもすべて NG（過去に貫通した実例）:
    - 「多様性に関する取り組み」
    - 「多様性の維持や向上に向けた取り組み」
    - 「多様性に対する取り組み」
    - 「ダイバーシティ推進」「D&I の活動」「女性活躍を促進」
- 「多様性」という語を出すなら **「多様性指標」「多様性データ」** のように **数値の指標を指す名詞** として使うことだけ許す。それ以外の文脈では一切使わない。
- 「働きやすい環境」「制度が整っている」「安定した職場環境」「魅力的な職場」のような根拠なき肯定評価は禁止
- 男女別賃金カーブの数値が示されていないため、男女別賃金差については書かない（このセクションでは比率のみ扱う）
- 比率の数値が「未公表／未取得」のときは、推測で施策や姿勢に言及しない。事実として「公表されていない」とだけ書く

<p> タグの段落のみ。`;

  const r = await callOpenAi({
    model,
    system: BASE_SYSTEM,
    user: userPrompt,
    maxOutputTokens: 800,
  });
  if (!r.ok) return r;

  const html = `<h2>男女別の年収・多様性</h2>\n${r.content}`;
  const warnings = detectHallucinations(r.content);
  return { html, usage: r.usage, warnings: warnings.length ? warnings : undefined };
}

async function genPersonaGuide(
  ctx: SalaryArticleContext,
  model: AiModelId
): Promise<GenerateResult | { ok: false; error: string }> {
  const c = ctx.company;
  const latest = ctx.history[0];

  // 業界平均（最新年度）— 「業界中央値との比較」を AI に正しく書かせるために必須
  const ia = ctx.industry_averages.find(
    (a) => latest && a.fiscal_year === latest.fiscal_year
  );
  const indAvg = ia?.avg_annual_salary ?? null;
  const diff =
    indAvg != null && latest?.average_annual_salary != null
      ? latest.average_annual_salary - indAvg
      : null;
  const diffLabel =
    diff != null
      ? diff >= 0
        ? `業界平均より +${toManYen(diff)} 高い水準`
        : `業界平均より ${toManYen(diff)} 低い水準`
      : "業界平均との比較データなし";

  const userPrompt = `${c.name} に関心を持つ 3 ペルソナへ向けたガイドを書きます。

【数値の前提】
- 平均年収: ${toManYen(latest?.average_annual_salary)}
- 平均年齢: ${latest?.average_age ?? "—"} 歳
- 業種: ${c.industry_name ?? "—"}
- 従業員数: ${formatNumber(latest?.employee_count)} 人
- 業界平均年収: ${indAvg != null ? toManYen(indAvg) : "—"}（${diffLabel}）

3 つの h3 を立てて、それぞれ地の文 200〜300 字で書いてください。箇条書き禁止。

1. <h3>転職を検討中の方へ</h3>
   平均年収・平均年齢から「同社で目安となる年収レンジ」を観察。年代別の詳細推計は別セクション（年代別の推定年収）に誘導してよい。

2. <h3>就活生の方へ</h3>
   平均年齢・勤続から見える「若手社員が現場で何年かけてどの水準に至るか」の目安を、与えられた数値の範囲で観察。

3. <h3>現職社員の方へ</h3>
   業界平均年収との差「${diffLabel}」を踏まえた市場価値の見立て。同業他社比較の詳細は別セクション（同業他社との比較）に誘導してよい。

【厳守 — どのペルソナでも書いてはいけないこと】
- 初任給の金額・水準感（データソース無し）
- 賞与の月数（データソース無し）
- 配属先・部門・職種の情報（データソース無し）
- 研修制度・教育プログラム・OJT・資格取得支援
- 福利厚生の具体（住宅手当・社員寮・育休 等）
- 海外展開・海外駐在・グローバル人材
- ジョブローテーション・人事異動・昇進ルート
- 残業時間・労働時間
- 「魅力的な職場」「理想的な環境」「安定した職場環境」「成長が期待される」のような主観表現
- 業界平均との大小関係を上の数値と逆に書くこと（事実誤認の禁止）

各セクションは <h3> と <p> のみで構成。`;

  const r = await callOpenAi({
    model,
    system: BASE_SYSTEM,
    user: userPrompt,
    maxOutputTokens: 1500,
  });
  if (!r.ok) return r;

  const html = `<h2>あなたの立場で読み解く</h2>\n${r.content}`;
  const warnings = detectHallucinations(r.content);
  return { html, usage: r.usage, warnings: warnings.length ? warnings : undefined };
}

/**
 * §4.12 FAQ。
 *
 * かつてはハードコードした 12 問を全て AI に答えさせていたが、データ無しの
 * トピック（残業時間／福利厚生／中途採用交渉／今後の見通し 等）を AI に
 * 答えさせると 100% 捏造する事故が発覚したため、以下の方針に変更:
 *
 *  - データの有無で動的に質問構成を決める
 *  - 雛形回答で十分な質問（初任給・退職金）はコードで固定文を埋め込む
 *  - AI には数値の前提を渡したうえで、「データ範囲内で」答えさせる
 *  - データソースが無いトピックは質問自体を出さない
 */
async function genFaq(
  ctx: SalaryArticleContext,
  model: AiModelId
): Promise<GenerateResult | { ok: false; error: string }> {
  const c = ctx.company;
  const latest = ctx.history[0];
  const avg = latest?.average_annual_salary ?? null;

  // 業界平均（最新年度）
  const ia = ctx.industry_averages.find(
    (a) => latest && a.fiscal_year === latest.fiscal_year
  );
  const indAvg = ia?.avg_annual_salary ?? null;
  const diff = indAvg != null && avg != null ? avg - indAvg : null;

  // 5 年前比較（履歴 5 件あるときだけ）
  const fiveYearsAgo = ctx.history.find(
    (m) => latest && m.fiscal_year === latest.fiscal_year - 4
  );
  const fiveYearGain =
    fiveYearsAgo?.average_annual_salary != null && avg != null
      ? avg - fiveYearsAgo.average_annual_salary
      : null;

  // 年代別推計（§4.5 と同じロジックを呼んで FAQ にも整合させる）
  let ageBands: { label: string; value_man: number }[] = [];
  if (avg != null) {
    const ageResult = estimateAgeSalary({
      companyAvgAnnualYen: avg,
      industryName: c.industry_name,
    });
    if (ageResult) {
      // 20-24 + 25-29 → 20代、30-34 + 35-39 → 30代、40-44 + 45-49 → 40代の中点を採用
      const pick = (a: string, b: string) => {
        const ra = ageResult.rows.find((r) => r.age_class === a);
        const rb = ageResult.rows.find((r) => r.age_class === b);
        if (!ra || !rb) return null;
        return Math.round((ra.estimated_annual_yen + rb.estimated_annual_yen) / 2 / 10000);
      };
      const v20 = pick("20-24", "25-29");
      const v30 = pick("30-34", "35-39");
      const v40 = pick("40-44", "45-49");
      if (v20 != null) ageBands.push({ label: "20代", value_man: v20 });
      if (v30 != null) ageBands.push({ label: "30代", value_man: v30 });
      if (v40 != null) ageBands.push({ label: "40代", value_man: v40 });
    }
  }

  // 同業比較順位（peer_meta から）
  const selfRank = ctx.peer_meta.self_rank;
  const totalInIndustry = ctx.peer_meta.total_in_industry;

  // ── AI に答えさせる質問群（データに応じて動的構成） ──────────────────
  type AiQ = { q: string; hint: string };
  const aiQuestions: AiQ[] = [];

  if (avg != null) {
    aiQuestions.push({
      q: `${c.name} の平均年収は？`,
      hint: `平均年収 ${toManYen(avg)}（${latest?.fiscal_year ?? "—"}年度）と、平均年齢 ${latest?.average_age ?? "—"} 歳・平均勤続 ${latest?.average_tenure_years ?? "—"} 年だけを根拠に、年収水準を端的に答える。`,
    });
  }

  if (avg != null && indAvg != null && diff != null) {
    aiQuestions.push({
      q: "業界平均と比べてどうですか？",
      hint: `業界（${c.industry_name ?? "—"}）平均年収 ${toManYen(indAvg)} に対し、${c.name} は ${toManYen(avg)}（差 ${diff >= 0 ? "+" : ""}${toManYen(diff)}）。差の方向（高い/低い）を間違えないこと。`,
    });
  }

  if (fiveYearGain != null && fiveYearsAgo) {
    aiQuestions.push({
      q: "5 年前と比較してどう変わりましたか？",
      hint: `${fiveYearsAgo.fiscal_year}年度 ${toManYen(fiveYearsAgo.average_annual_salary)} → ${latest?.fiscal_year}年度 ${toManYen(avg)}。差は ${fiveYearGain >= 0 ? "+" : ""}${toManYen(fiveYearGain)}。`,
    });
  }

  for (const band of ageBands) {
    aiQuestions.push({
      q: `${band.label}の年収はどれくらいですか？`,
      hint: `推定 ${band.value_man} 万円。賃金センサスの年齢別カーブから推計した値であり、実際の年収は職種・等級・地域で変動する旨を必ず添える。この数値を変更しないこと。`,
    });
  }

  if (latest?.average_overtime_hours != null) {
    aiQuestions.push({
      q: "残業時間はどれくらいですか？",
      hint: `有価証券報告書記載の月平均所定外労働時間：${latest.average_overtime_hours} 時間/月。この数値だけを根拠にし、業務内容や部門差については推測しない。`,
    });
  }

  if (latest?.female_manager_ratio != null) {
    const indFemale = ia?.avg_female_manager_ratio;
    aiQuestions.push({
      q: "女性管理職比率はどれくらいですか？",
      hint: `${latest.female_manager_ratio.toFixed(1)}%${indFemale != null ? `（業界平均 ${indFemale.toFixed(1)}%）` : ""}。比率の事実だけを答え、施策や取り組みには言及しない。`,
    });
  }

  if (selfRank != null && totalInIndustry > 0) {
    aiQuestions.push({
      q: "同業他社と比べて高いですか？",
      hint: `${c.industry_name ?? "—"} のうち平均年収を有報に記載している ${totalInIndustry} 社中 ${selfRank} 位。順位の事実だけを答える。トップ企業との金額差や推測コメントは不要。`,
    });
  }

  // ── AI には触れさせず、コードで固定回答する質問群 ─────────────────────
  // データソースが無く、AI に答えさせると確実に捏造する質問は、ここで
  // 「データなし」「別ページ参照」と明示する固定文を埋め込む。
  const fixedFaqs: { q: string; a_html: string }[] = [
    {
      q: `${c.name} の初任給はいくらですか？`,
      a_html:
        "初任給は学歴・職種・勤務地・配属部門で大きく異なるため、有価証券報告書からは確定値を取得していません。最新の確定値は同社の公式採用情報をご確認ください。",
    },
    {
      q: `${c.name} の賞与（ボーナス）は何か月分ですか？`,
      a_html:
        "賞与の年間支給月数は労使交渉で年度ごとに変動するため、本記事では推計値を掲載していません。最新の妥結結果は同社の公式採用情報・IR 資料・有価証券報告書をご確認ください。",
    },
    {
      q: `${c.name} の退職金はいくらくらいですか？`,
      a_html:
        "退職金規程・自己都合 / 会社都合・確定拠出年金の有無で大きく変動します。本記事では「大企業 60 歳定年・勤続 38 年」の経験則として平均年収の 2.5 倍を採用した試算値のみ掲載しています（生涯年収セクション参照）。",
    },
  ];

  if (aiQuestions.length === 0) {
    // 平均年収すら無いケース：固定文だけで FAQ を構成
    const fixedHtml = fixedFaqs
      .map(
        (f) =>
          `<details class="faq-item">\n  <summary>${escapeHtml(f.q)}</summary>\n  <p>${escapeHtml(f.a_html)}</p>\n</details>`
      )
      .join("\n");
    const html = `<h2>よくある質問（FAQ）</h2>\n<div class="faq-section" data-type="faq-section">\n${fixedHtml}\n</div>`;
    return { html, usage: ZERO_USAGE };
  }

  const userPrompt = `${c.name} の年収に関する FAQ を ${aiQuestions.length} 問書いてください。

各問について、与えた【根拠】の範囲内だけで 60〜120 字の回答を作ってください。複数文 OK。
**質問文は変更しないでください**（読者目線への微調整は OK ですが、意味を変えてはいけません）。
**出力形式は厳密に次の構造**で、各問を <details> でアコーディオン化してください:

<details class="faq-item">
  <summary>{質問}</summary>
  <p>{回答}</p>
</details>

${aiQuestions.length} 個の <details> を続けて並べてください。<details> の外側に <div class="faq-section"> でラップしてください。
他のタグ（<h2>, <h3>, <ul> 等）や前置き文・コードフェンスは禁止。

質問と根拠:
${aiQuestions
  .map((q, i) => `${i + 1}. Q: ${q.q}\n   根拠: ${q.hint}`)
  .join("\n\n")}

【絶対厳守】
- 各回答は与えた【根拠】の数値・事実のみを使う。それ以外の数値（残業時間・初任給・賞与月数・福利厚生制度・教育制度・海外展開・組織風土）には一切触れない
- 「業界をリードする」「成長が期待される」「安定した職場環境」「魅力的な選択肢」のような主観評価は禁止
- 因果関係は断定しない（観察として書く）
- 与えた数値以外を新たに作らない（捏造禁止）`;

  const r = await callOpenAi({
    model,
    system: BASE_SYSTEM,
    user: userPrompt,
    maxOutputTokens: 3000,
  });
  if (!r.ok) return r;

  // AI 出力（aiQuestions 群）を取り出し、固定 FAQ を末尾に連結する
  const aiContent = r.content.trim();
  // <div class="faq-section"> でラップされている場合は中身だけ抜き出す
  const innerMatch = aiContent.match(/<div[^>]*class="faq-section"[^>]*>([\s\S]*?)<\/div>\s*$/i);
  const aiInner = innerMatch ? innerMatch[1].trim() : aiContent;

  const fixedHtml = fixedFaqs
    .map(
      (f) =>
        `<details class="faq-item">\n  <summary>${escapeHtml(f.q)}</summary>\n  <p>${escapeHtml(f.a_html)}</p>\n</details>`
    )
    .join("\n");

  const html = `<h2>よくある質問（FAQ）</h2>\n<div class="faq-section" data-type="faq-section">\n${aiInner}\n${fixedHtml}\n</div>`;
  const warnings = detectHallucinations(aiInner);
  return { html, usage: r.usage, warnings: warnings.length ? warnings : undefined };
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

  // 「最新」表記用の年：常に「実行時点の今年」を使う（記事更新タイミングを表す）
  const now = new Date();
  const year = now.getFullYear();

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
