"use server";

import { isCurrentUserAdmin } from "@/lib/auth/is-admin";
import { AI_MODELS, type AiModelId } from "../ai-write-prompt";
import { loadSalaryArticleContext } from "./data";
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
