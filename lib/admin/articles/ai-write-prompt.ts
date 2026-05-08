// プロンプト組み立て / トークン推定 / コスト計算 / モデル定義
// 純粋関数のみ。server / client 両方から import される（"server-only" を付けない）。

// =====================================================================
// モデル定義
// =====================================================================

export type AiModelId = "gpt-4o-mini" | "gpt-4o" | "claude-sonnet-4-6" | "claude-haiku-4-5";

export type AiModelDef = {
  label: string;
  provider: "openai" | "anthropic";
  /** $/1M tokens */
  input_per_1m: number;
  output_per_1m: number;
  /** UI 表示で「準備中」扱いするか。MVP では gpt-4o-mini のみ true */
  available: boolean;
  /** 出力長の目安上限 */
  max_output_tokens: number;
  notes?: string;
};

export const AI_MODELS: Record<AiModelId, AiModelDef> = {
  "gpt-4o-mini": {
    label: "gpt-4o-mini",
    provider: "openai",
    input_per_1m: 0.15,
    output_per_1m: 0.6,
    available: true,
    max_output_tokens: 16000,
    notes: "高速・低コスト。標準",
  },
  "gpt-4o": {
    label: "gpt-4o",
    provider: "openai",
    input_per_1m: 2.5,
    output_per_1m: 10.0,
    available: false,
    max_output_tokens: 16000,
    notes: "文体品質高。コストは ~17 倍",
  },
  "claude-sonnet-4-6": {
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
    input_per_1m: 3.0,
    output_per_1m: 15.0,
    available: false,
    max_output_tokens: 8000,
    notes: "長文・日本語品質に強い",
  },
  "claude-haiku-4-5": {
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    input_per_1m: 0.8,
    output_per_1m: 4.0,
    available: false,
    max_output_tokens: 8000,
    notes: "高速・中品質",
  },
};

// =====================================================================
// データ詳細度
// =====================================================================

export type DetailLevel = "light" | "standard" | "rich";

export const DETAIL_LEVELS: Record<DetailLevel, { label: string; description: string; tokens_per_company: number }> = {
  light: {
    label: "軽量",
    description: "概要のみ",
    tokens_per_company: 250,
  },
  standard: {
    label: "標準",
    description: "+ 主要数値",
    tokens_per_company: 600,
  },
  rich: {
    label: "リッチ",
    description: "+ 5 年推移・業界比較",
    tokens_per_company: 1500,
  },
};

// =====================================================================
// 企業コンテキスト型（Server Action が DB から組み立てて渡す）
// =====================================================================

export type CompanyContext = {
  edinet_code: string;
  name: string;
  industry_name: string | null;
  summary: string | null;
  // standard 以上で含める
  latest_metrics?: {
    fiscal_year: number;
    average_annual_salary: number | null;
    average_age: number | null;
    average_tenure_years: number | null;
    employee_count: number | null;
    revenue: number | null;
    operating_income: number | null;
    net_income: number | null;
  } | null;
  // rich のみ含める
  metrics_history?: Array<{
    fiscal_year: number;
    average_annual_salary: number | null;
    employee_count: number | null;
    revenue: number | null;
    operating_income: number | null;
  }>;
  industry_average?: {
    fiscal_year: number;
    avg_annual_salary: number | null;
    avg_employee_count: number | null;
  } | null;
};

// =====================================================================
// プロンプト組み立て
// =====================================================================

const BASE_SYSTEM_PROMPT = `あなたは年収辞典の経済ジャーナリスト・編集ライターです。
読者は転職検討者・現職社員・投資家。与えられた企業データのみを使って、ライター品質の本文を書きます。

【出力形式】
- HTML で返す（TipTap が解釈できる以下のタグのみ使用：h2, h3, p, ul, ol, li, blockquote, strong, em, a）
- 本文のみを返す（前置き・後書き・コードフェンス・「以下」「上記」の説明文は禁止）
- 文章のあいだで <p> 区切りを徹底する

【書き方のルール】
- 文末は「です・ます」基本、ところどころ体言止めやダッシュ「——」でリズムを変える
- 「注目すべきは」「実は」「とはいえ」「ただし」「一方で」で論理転換を入れる
- パーセント数値は最低 1 つ金額換算（例：「+12%」→「およそ 100 万円多い」）
- 数字は与えられた値だけを使う。捏造禁止。因果関係は断定しない

【禁止表現】
- 「〜することができます」「〜と言えるでしょう」
- 「非常に」「大変」「極めて」「総合的に」「全体的に」「基本的には」
- 「〜が重要です」「〜が求められています」「〜していきます」「いかがでしたか」
- 「持続的成長」「企業価値向上」など経営計画用語
- 「優れた技術力」「高い競争力」「業界トップクラス」など主観的賛辞`;

function fmtNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("ja-JP");
}

function fmtBigYen(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)} 億円`;
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(0)} 万円`;
  return `${n.toLocaleString("ja-JP")} 円`;
}

function fmtSalary(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Math.round(n / 10000).toLocaleString("ja-JP")} 万円`;
}

/** 1 社の整形テキスト（detailLevel に応じて出し分け） */
export function formatCompanyForPrompt(
  c: CompanyContext,
  detailLevel: DetailLevel
): string {
  const lines: string[] = [];
  lines.push(`### ${c.name}（EDINET ${c.edinet_code}${c.industry_name ? ` / ${c.industry_name}` : ""}）`);
  if (c.summary) {
    lines.push(`概要: ${c.summary}`);
  }

  if (detailLevel === "light") {
    return lines.join("\n");
  }

  // standard 以上
  const lm = c.latest_metrics;
  if (lm) {
    lines.push(`最新数値（${lm.fiscal_year}年度）:`);
    lines.push(`  平均年収: ${fmtSalary(lm.average_annual_salary)}`);
    lines.push(`  平均年齢: ${lm.average_age != null ? `${lm.average_age} 歳` : "—"}`);
    lines.push(`  平均勤続: ${lm.average_tenure_years != null ? `${lm.average_tenure_years} 年` : "—"}`);
    lines.push(`  従業員数: ${fmtNumber(lm.employee_count)} 人`);
    lines.push(`  売上: ${fmtBigYen(lm.revenue)}`);
    lines.push(`  営業利益: ${fmtBigYen(lm.operating_income)}`);
    lines.push(`  当期純利益: ${fmtBigYen(lm.net_income)}`);
  }

  if (detailLevel === "standard") {
    return lines.join("\n");
  }

  // rich
  if (c.metrics_history && c.metrics_history.length > 1) {
    lines.push(`過去 5 年推移（古→新）:`);
    const sorted = [...c.metrics_history].sort(
      (a, b) => (a.fiscal_year ?? 0) - (b.fiscal_year ?? 0)
    );
    for (const m of sorted) {
      lines.push(
        `  ${m.fiscal_year}: 年収 ${fmtSalary(m.average_annual_salary)}, 従業員 ${fmtNumber(m.employee_count)}, 売上 ${fmtBigYen(m.revenue)}, 営業利益 ${fmtBigYen(m.operating_income)}`
      );
    }
  }
  if (c.industry_average) {
    lines.push(
      `業界平均（${c.industry_average.fiscal_year}年度）: 年収 ${fmtSalary(c.industry_average.avg_annual_salary)}, 平均従業員 ${fmtNumber(c.industry_average.avg_employee_count)} 人`
    );
  }

  return lines.join("\n");
}

export function buildPrompt(args: {
  companies: CompanyContext[];
  detailLevel: DetailLevel;
  userInstruction: string;
  supplementalMemo: string;
  targetChars: number;
}): { system: string; user: string } {
  const { companies, detailLevel, userInstruction, supplementalMemo, targetChars } = args;

  const companiesBlock = companies
    .map((c) => formatCompanyForPrompt(c, detailLevel))
    .join("\n\n");

  const memoBlock = supplementalMemo.trim()
    ? `\n\n【補足メモ（編集者が貼り付けたニュースや背景。本文の文脈づくりに活用してよい。ただし数値は与えられたデータを優先）】\n${supplementalMemo.trim()}`
    : "";

  const user = `次の企業データを使って、HTML で記事本文を書いてください。
本文は概ね **${targetChars} 字程度** に収めてください。

【書いて欲しい内容（編集者の指示）】
${userInstruction.trim() || "（指示なし。企業データを踏まえた一般的な紹介文を書いてください）"}

【企業データ】
${companiesBlock}${memoBlock}

上記の制約に従って HTML 本文だけを返してください。`;

  return { system: BASE_SYSTEM_PROMPT, user };
}

// =====================================================================
// トークン推定 + コスト計算
// =====================================================================

const BASE_PROMPT_TOKENS = 500; // system + boilerplate

/**
 * 文字数 → トークン数の概算。
 * 日本語は 1 char ≒ 1 token、英数字は ~4 char/token。
 * 安全側で 1.0 char/token とする。
 */
function charsToTokens(chars: number): number {
  return Math.ceil(chars);
}

export function estimateTokens(args: {
  detailLevel: DetailLevel;
  companyCount: number;
  userInstructionChars: number;
  supplementalMemoChars: number;
  targetChars: number;
}): { input: number; output: number } {
  const tokensPerCompany = DETAIL_LEVELS[args.detailLevel].tokens_per_company;
  const input =
    BASE_PROMPT_TOKENS +
    Math.max(0, args.companyCount) * tokensPerCompany +
    charsToTokens(args.userInstructionChars) +
    charsToTokens(args.supplementalMemoChars);

  // 日本語 + HTML タグ込みで output ~= target_chars / 1.5（経験値）
  const output = Math.ceil(args.targetChars / 1.5);

  return { input, output };
}

export function estimateCostUsd(args: {
  model: AiModelId;
  inputTokens: number;
  outputTokens: number;
}): number {
  const m = AI_MODELS[args.model];
  return (
    (args.inputTokens / 1_000_000) * m.input_per_1m +
    (args.outputTokens / 1_000_000) * m.output_per_1m
  );
}

/**
 * UI 用：USD 表記をフォーマット
 */
export function formatUsd(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
