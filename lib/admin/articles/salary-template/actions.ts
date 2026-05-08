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
