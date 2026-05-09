"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "@/lib/auth/is-admin";
import { AI_MODELS, type AiModelId } from "../ai-write-prompt";
import {
  findSalaryReadyHistory,
  loadSalaryArticleContext,
  type SalaryFinancialMetric,
} from "./data";
import {
  buildSalaryTitle,
  generateSection,
  type GenerateResult,
  type SalaryTitleResult,
} from "./generators";
import { SALARY_SECTION_BY_ID } from "./sections";

export type GenerateSalarySectionInput = {
  articleId: string;
  sectionId: string;
  model: AiModelId;
};

export type GenerateSalarySectionResult =
  | { ok: true; data: GenerateResult }
  | { ok: false; error: string };

export async function generateSalarySection(
  input: GenerateSalarySectionInput
): Promise<GenerateSalarySectionResult> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };

  const sectionDef = SALARY_SECTION_BY_ID[input.sectionId];
  if (!sectionDef)
    return { ok: false, error: `未知のセクション: ${input.sectionId}` };

  const modelDef = AI_MODELS[input.model];
  if (!modelDef) return { ok: false, error: `未知のモデル: ${input.model}` };
  if (!modelDef.available)
    return { ok: false, error: `${modelDef.label} は現在準備中です` };

  const ctxRes = await loadSalaryArticleContext(input.articleId);
  if (!ctxRes.ok) return { ok: false, error: ctxRes.error };

  return await generateSection({
    sectionId: input.sectionId,
    ctx: ctxRes.data,
    model: input.model,
  });
}

export type GenerateSalaryTitleResult =
  | { ok: true; data: SalaryTitleResult }
  | { ok: false; error: string };

/**
 * 紐付き企業のデータから SEO 最適な記事タイトルを決定論的に生成する。
 * AI を呼ばないので即時返答・コスト 0。
 */
export async function generateSalaryTitle(
  articleId: string
): Promise<GenerateSalaryTitleResult> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };

  const ctxRes = await loadSalaryArticleContext(articleId);
  if (!ctxRes.ok) return { ok: false, error: ctxRes.error };

  return { ok: true, data: buildSalaryTitle(ctxRes.data) };
}

// =====================================================================
// 使用する有報データのメタ情報（モーダル表示用）
// =====================================================================

export type SalaryDataSourceMeta = {
  /** 紐付き企業の最新有報の年度 */
  fiscal_year: number | null;
  /** EDINET 書類 ID */
  doc_id: string | null;
  /** 提出日 (ISO 文字列) */
  submitted_at: string | null;
  /** financial_metrics に何年分入っているか */
  history_count: number;
  /** 提出日からの経過月数（鮮度判定用） */
  age_months: number | null;
  /** 鮮度ラベル：fresh = 12 ヶ月以内 / stale = 12〜24 ヶ月 / very_stale = 24 ヶ月超 / unknown */
  freshness: "fresh" | "stale" | "very_stale" | "unknown";
};

export type GetSalaryDataSourceResult =
  | { ok: true; data: SalaryDataSourceMeta }
  | { ok: false; error: string };

/**
 * 紐付き企業の最新有報メタ情報を取得する。
 * モーダル表示で「いまどの年度の有報データを使って生成するか」を読者に明示するために使用。
 *
 * 注：今後「より新しい有報が EDINET に存在するか」のチェック機能を追加する想定。
 * 現状は financial_metrics の最新行を見るのみ。
 */
export async function getSalaryDataSourceMeta(
  articleId: string
): Promise<GetSalaryDataSourceResult> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };

  const ctxRes = await loadSalaryArticleContext(articleId);
  if (!ctxRes.ok) return { ok: false, error: ctxRes.error };

  const latest = ctxRes.data.history[0] ?? null;
  const submittedAt = latest?.submitted_at ?? null;

  let ageMonths: number | null = null;
  let freshness: SalaryDataSourceMeta["freshness"] = "unknown";
  if (submittedAt) {
    const submitted = new Date(submittedAt);
    if (!Number.isNaN(submitted.getTime())) {
      const now = new Date();
      ageMonths =
        (now.getFullYear() - submitted.getFullYear()) * 12 +
        (now.getMonth() - submitted.getMonth());
      if (ageMonths < 0) ageMonths = 0;
      freshness =
        ageMonths <= 12 ? "fresh" : ageMonths <= 24 ? "stale" : "very_stale";
    }
  }

  return {
    ok: true,
    data: {
      fiscal_year: latest?.fiscal_year ?? null,
      doc_id: latest?.doc_id ?? null,
      submitted_at: submittedAt,
      history_count: ctxRes.data.history.length,
      age_months: ageMonths,
      freshness,
    },
  };
}

// =====================================================================
// モーダル開いた直後に必要な「軽量メタ情報」をまとめて取得する。
//
// SalaryTemplateDialog はオープン直後に「タイトル候補」と「最新有報メタ情報」を
// 表示するが、それぞれ独立に loadSalaryArticleContext を叩いていたため
// 重いクエリ（業界平均・同業他社ピア）を 2 回引いていた。
// 本アクションはそれらを一切使わず、必要最小限の SELECT のみで両方を返す。
// =====================================================================

export type SalarySalaryAvailability = {
  /** 平均年収データを使った記事生成が可能か */
  available: boolean;
  /** 1 年前のデータを利用しているか（最新有報に未掲載のため） */
  used_fallback: boolean;
  /** 実際に「最新」として参照した年度 */
  fiscal_year_used: number | null;
};

export type SalaryDialogOpenMeta = {
  title: SalaryTitleResult;
  dataSource: SalaryDataSourceMeta;
  /** 平均年収データの可用性。available=false ならモーダルで生成ボタンを無効化する */
  salaryAvailability: SalarySalaryAvailability;
};
export type GetSalaryDialogOpenMetaResult =
  | { ok: true; data: SalaryDialogOpenMeta }
  | { ok: false; error: string };

export async function getSalaryDialogOpenMeta(
  articleId: string
): Promise<GetSalaryDialogOpenMetaResult> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "管理者権限が必要です" };

  const sb = createSupabaseAdminClient();

  // 1) 紐付き企業 1 社目を取得（先頭のみ）
  const acRes = await sb
    .from("article_companies")
    .select("company_id")
    .eq("article_id", articleId)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (acRes.error) return { ok: false, error: acRes.error.message };
  if (!acRes.data) {
    return {
      ok: false,
      error:
        "この記事に企業が紐付いていません。先に「関連企業」を 1 社追加してください",
    };
  }
  const companyId = (acRes.data as { company_id: string }).company_id;

  // 2) 企業の name と、財務指標の history を 1 ラウンドトリップずつで並列取得
  const [companyRes, fmRes] = await Promise.all([
    sb.from("companies").select("id, name").eq("id", companyId).maybeSingle(),
    sb
      .from("financial_metrics")
      .select("fiscal_year, average_annual_salary, doc_id, submitted_at")
      .eq("company_id", companyId)
      .order("fiscal_year", { ascending: false }),
  ]);
  if (companyRes.error || !companyRes.data) {
    return { ok: false, error: "企業データが取得できません" };
  }
  if (fmRes.error) {
    return { ok: false, error: fmRes.error.message };
  }
  const company = companyRes.data as { id: string; name: string };
  const rawHistory = (fmRes.data ?? []) as Array<{
    fiscal_year: number;
    average_annual_salary: number | null;
    doc_id: string | null;
    submitted_at: string | null;
  }>;
  // SalaryFinancialMetric 型に正規化（最小限のフィールドだけ持つ）
  const fullHistory: SalaryFinancialMetric[] = rawHistory.map((h) => ({
    fiscal_year: h.fiscal_year,
    average_annual_salary: h.average_annual_salary,
    average_age: null,
    average_tenure_years: null,
    employee_count: null,
    female_manager_ratio: null,
    average_overtime_hours: null,
    revenue: null,
    operating_income: null,
    ordinary_income: null,
    net_income: null,
    doc_id: h.doc_id,
    submitted_at: h.submitted_at,
  }));
  const trimmed = findSalaryReadyHistory(fullHistory);
  // dataSource パネルでは「実際に参照した最新有報」を表示するので
  // トリミング後の先頭行を使う。トリミングで空になった場合は元の先頭を表示。
  const dataSourceRow = trimmed.history[0] ?? rawHistory[0] ?? null;

  // 3) タイトル（buildSalaryTitle は company.name と history[0].average_annual_salary しか
  //    使わないので、最小限の SalaryArticleContext を組み立てて呼ぶ）
  const title = buildSalaryTitle({
    article: { id: articleId, title: "" },
    company: {
      id: company.id,
      edinet_code: "",
      securities_code: null,
      corporate_number: null,
      name: company.name,
      name_kana: null,
      industry_code: null,
      industry_name: null,
      listed_market: null,
      description: null,
      summary: null,
      website_url: null,
      headquarters: null,
      founded_year: null,
      founded_at: null,
      representative: null,
      capital_stock_yen: null,
      fiscal_year_end_month: null,
    },
    history: trimmed.history,
    industry_averages: [],
    peers: [],
  });

  // 4) データソースメタ（getSalaryDataSourceMeta と同じロジック）
  let ageMonths: number | null = null;
  let freshness: SalaryDataSourceMeta["freshness"] = "unknown";
  if (dataSourceRow?.submitted_at) {
    const submitted = new Date(dataSourceRow.submitted_at);
    if (!Number.isNaN(submitted.getTime())) {
      const now = new Date();
      ageMonths =
        (now.getFullYear() - submitted.getFullYear()) * 12 +
        (now.getMonth() - submitted.getMonth());
      if (ageMonths < 0) ageMonths = 0;
      freshness =
        ageMonths <= 12 ? "fresh" : ageMonths <= 24 ? "stale" : "very_stale";
    }
  }

  return {
    ok: true,
    data: {
      title,
      dataSource: {
        fiscal_year: dataSourceRow?.fiscal_year ?? null,
        doc_id: dataSourceRow?.doc_id ?? null,
        submitted_at: dataSourceRow?.submitted_at ?? null,
        history_count: trimmed.history.length,
        age_months: ageMonths,
        freshness,
      },
      salaryAvailability: {
        available: trimmed.available,
        used_fallback: trimmed.used_fallback,
        fiscal_year_used: trimmed.fiscal_year_used,
      },
    },
  };
}
