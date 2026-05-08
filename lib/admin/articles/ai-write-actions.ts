"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";
import {
  AI_MODELS,
  buildPrompt,
  estimateCostUsd,
  type AiModelId,
  type CompanyContext,
  type DetailLevel,
} from "./ai-write-prompt";

export type GenerateArticleDraftInput = {
  articleId: string;
  model: AiModelId;
  detailLevel: DetailLevel;
  userInstruction: string;
  supplementalMemo: string;
  targetChars: number;
};

export type GenerateArticleDraftResult =
  | {
      ok: true;
      data: {
        html: string;
        usage: {
          input_tokens: number;
          output_tokens: number;
          cost_usd: number;
        };
      };
    }
  | { ok: false; error: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateArticleDraft(
  input: GenerateArticleDraftInput
): Promise<GenerateArticleDraftResult> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };

  const modelDef = AI_MODELS[input.model];
  if (!modelDef) return { ok: false, error: `未知のモデル: ${input.model}` };
  if (!modelDef.available) {
    return { ok: false, error: `${modelDef.label} は現在準備中です` };
  }
  if (modelDef.provider !== "openai") {
    return {
      ok: false,
      error: `現在 OpenAI モデルのみ対応しています（${modelDef.provider} は未実装）`,
    };
  }

  // 紐付き企業 → コンテキスト構築
  const companies = await loadCompanyContexts(
    input.articleId,
    input.detailLevel
  );

  if (companies.length === 0) {
    return {
      ok: false,
      error:
        "この記事には企業が紐付いていません。先に「関連企業」を追加してください",
    };
  }

  const { system, user } = buildPrompt({
    companies,
    detailLevel: input.detailLevel,
    userInstruction: input.userInstruction,
    supplementalMemo: input.supplementalMemo,
    targetChars: input.targetChars,
  });

  // OpenAI 呼び出し
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "OPENAI_API_KEY が未設定です" };
  }

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
          model: input.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.4,
          // 出力の上限を希望文字数の 2.5 倍程度（モデル上限を超えないように）
          max_tokens: Math.min(
            modelDef.max_output_tokens,
            Math.max(800, Math.ceil((input.targetChars / 1.5) * 2.5))
          ),
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          choices: { message: { content: string } }[];
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
          };
        };
        const raw = json.choices[0]?.message?.content?.trim() ?? "";
        const html = sanitizeAiHtml(raw);
        const inTok = json.usage?.prompt_tokens ?? 0;
        const outTok = json.usage?.completion_tokens ?? 0;
        const cost = estimateCostUsd({
          model: input.model,
          inputTokens: inTok,
          outputTokens: outTok,
        });
        return {
          ok: true,
          data: {
            html,
            usage: {
              input_tokens: inTok,
              output_tokens: outTok,
              cost_usd: cost,
            },
          },
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

// =====================================================================
// 紐付き企業のコンテキスト構築
// =====================================================================

async function loadCompanyContexts(
  articleId: string,
  detailLevel: DetailLevel
): Promise<CompanyContext[]> {
  const sb = createSupabaseAdminClient();

  // 紐付き company_id を取得
  const acRes = await sb
    .from("article_companies")
    .select("company_id, display_order")
    .eq("article_id", articleId)
    .order("display_order", { ascending: true });
  if (acRes.error || !acRes.data || acRes.data.length === 0) return [];

  const companyIds = acRes.data.map((r) => r.company_id as string);

  // 企業基本 + 業界
  const cRes = await sb
    .from("companies")
    .select(
      "id, edinet_code, name, industry_code, summary, industries(name)"
    )
    .in("id", companyIds);
  if (cRes.error || !cRes.data) return [];

  // 並び順を維持しつつ map
  const byId = new Map<string, any>();
  for (const c of cRes.data) byId.set(c.id as string, c);

  // standard 以上で metrics 取得（最新 + 5 年分）
  let metricsByCompany = new Map<string, any[]>();
  if (detailLevel !== "light") {
    const fmRes = await sb
      .from("financial_metrics")
      .select(
        "company_id, fiscal_year, average_annual_salary, average_age, average_tenure_years, employee_count, revenue, operating_income, net_income"
      )
      .in("company_id", companyIds)
      .order("fiscal_year", { ascending: false });
    if (!fmRes.error && fmRes.data) {
      for (const m of fmRes.data) {
        const arr = metricsByCompany.get(m.company_id as string) ?? [];
        arr.push(m);
        metricsByCompany.set(m.company_id as string, arr);
      }
    }
  }

  // rich で業界平均
  let indAvgByCode = new Map<string, any>();
  if (detailLevel === "rich") {
    const industryCodes = Array.from(
      new Set(
        cRes.data
          .map((c: any) => c.industry_code as string | null)
          .filter((x): x is string => Boolean(x))
      )
    );
    if (industryCodes.length > 0) {
      const indRes = await sb
        .from("industry_averages")
        .select(
          "industry_code, fiscal_year, avg_annual_salary, avg_employee_count"
        )
        .in("industry_code", industryCodes)
        .order("fiscal_year", { ascending: false });
      if (!indRes.error && indRes.data) {
        for (const a of indRes.data) {
          const code = a.industry_code as string;
          // 最新年度のみ採用
          if (!indAvgByCode.has(code)) indAvgByCode.set(code, a);
        }
      }
    }
  }

  return acRes.data.map((ac) => {
    const c = byId.get(ac.company_id as string);
    const ind = Array.isArray(c?.industries) ? c.industries[0] : c?.industries;
    const history = metricsByCompany.get(ac.company_id as string) ?? [];
    const latest = history[0] ?? null;

    const ctx: CompanyContext = {
      edinet_code: c?.edinet_code ?? "",
      name: c?.name ?? "",
      industry_name: ind?.name ?? null,
      summary: (c?.summary ?? null) as string | null,
    };

    if (detailLevel !== "light") {
      ctx.latest_metrics = latest
        ? {
            fiscal_year: latest.fiscal_year as number,
            average_annual_salary:
              (latest.average_annual_salary ?? null) as number | null,
            average_age: (latest.average_age ?? null) as number | null,
            average_tenure_years:
              (latest.average_tenure_years ?? null) as number | null,
            employee_count: (latest.employee_count ?? null) as number | null,
            revenue: latest.revenue != null ? Number(latest.revenue) : null,
            operating_income:
              latest.operating_income != null
                ? Number(latest.operating_income)
                : null,
            net_income:
              latest.net_income != null ? Number(latest.net_income) : null,
          }
        : null;
    }

    if (detailLevel === "rich") {
      ctx.metrics_history = history.slice(0, 5).map((m: any) => ({
        fiscal_year: m.fiscal_year as number,
        average_annual_salary:
          (m.average_annual_salary ?? null) as number | null,
        employee_count: (m.employee_count ?? null) as number | null,
        revenue: m.revenue != null ? Number(m.revenue) : null,
        operating_income:
          m.operating_income != null ? Number(m.operating_income) : null,
      }));
      const indAvg = c?.industry_code
        ? indAvgByCode.get(c.industry_code as string)
        : null;
      ctx.industry_average = indAvg
        ? {
            fiscal_year: indAvg.fiscal_year as number,
            avg_annual_salary:
              (indAvg.avg_annual_salary ?? null) as number | null,
            avg_employee_count:
              (indAvg.avg_employee_count ?? null) as number | null,
          }
        : null;
    }

    return ctx;
  });
}

// =====================================================================
// AI 出力の HTML サニタイズ（軽量）
// =====================================================================

/**
 * AI が ```html ... ``` で囲んで返したり、本文以外の前置きを書くケースを除去。
 * 完全な HTML サニタイズではないが、悪意ある script は TipTap のスキーマ側で弾かれる。
 */
function sanitizeAiHtml(raw: string): string {
  let s = raw.trim();
  // コードフェンス除去
  s = s.replace(/^```(?:html|markdown)?\s*\n?/i, "");
  s = s.replace(/\n?```\s*$/i, "");
  // 「以下が記事本文です」など前置きを軽く除去（行頭が明らかな日本語の前置きで <p> や <h で始まらない場合）
  // ここは緩くしておく（誤削除より残す方を優先）
  return s.trim();
}
