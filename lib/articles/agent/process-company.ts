// 1 タスク（= 1 企業）のライフサイクル。
// CLI ワーカー (scripts/articles/agent/drain-job.ts) から呼ばれる純関数。
// admin 認証は通らない（GitHub Actions 上の Node ランナーから直接呼ぶ）ので、
// 呼び出し側が service_role の SupabaseClient を渡す。

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decideSkipOrRewrite,
  findExistingSalaryArticleForCompany,
  loadLatestYuhoForCompanies,
  type LatestYuhoRow,
} from "@/lib/admin/articles/agent/skip-rewrite";
import { loadSalaryArticleContext } from "@/lib/admin/articles/salary-template/data";
import {
  buildSalaryTitle,
  generateSection,
} from "@/lib/admin/articles/salary-template/generators";
import { SALARY_SECTIONS } from "@/lib/admin/articles/salary-template/sections";
import { autoLinkXbrlDocsCore } from "./auto-link-xbrl-core";
import { resolveDefaultAuthorId } from "./default-author";

export type ProcessTaskInput = {
  id: string;
  job_id: string;
  company_id: string;
  /** 既に紐付け済みなら再利用する（CRASH 復旧の冪等性） */
  article_id: string | null;
};

export type ProcessTaskOptions = {
  rewriteIfNewerYuho: boolean;
  /** 同一有報の既存記事をスキップする（false なら強制リライト） */
  skipExisting: boolean;
  model: "gpt-4o-mini";
  /** 各セクション開始前に呼ばれ、true を返すと中断 */
  isCancelRequested?: () => Promise<boolean>;
};

export type ProcessTaskOutcome =
  | {
      kind: "succeeded";
      article_id: string;
      was_rewrite: boolean;
      cost_usd: number;
    }
  | {
      kind: "skipped";
      reason: string;
      article_id: string | null;
      cost_usd: number;
    }
  | {
      kind: "cancelled";
      article_id: string | null;
      cost_usd: number;
    }
  | {
      kind: "failed";
      error_code:
        | "load_context"
        | "section_failed"
        | "save_body"
        | "load_company"
        | "create_draft"
        | "unknown";
      error_message: string;
      article_id: string | null;
      cost_usd: number;
    };

/**
 * メインのタスク処理。途中で sections_done / cost_usd を進捗として
 * agent_job_tasks に書き込みつつ、最終結果を Outcome として返す。
 *
 * 最終的な status (succeeded / skipped / failed / cancelled) や
 * agent_jobs カウンタの更新は呼び出し側 (drain-job.ts) が行う。
 */
export async function processTask(
  sb: SupabaseClient,
  task: ProcessTaskInput,
  opts: ProcessTaskOptions
): Promise<ProcessTaskOutcome> {
  // ---------------------------------------------------------------
  // 1) 企業 + 最新有報を取得
  // ---------------------------------------------------------------
  const companyRes = await sb
    .from("companies")
    .select("id, name, edinet_code")
    .eq("id", task.company_id)
    .maybeSingle();
  if (companyRes.error || !companyRes.data) {
    return {
      kind: "failed",
      error_code: "load_company",
      error_message: companyRes.error?.message ?? "company not found",
      article_id: task.article_id,
      cost_usd: 0,
    };
  }
  const company = companyRes.data as {
    id: string;
    name: string;
    edinet_code: string;
  };

  let latest: LatestYuhoRow | undefined;
  try {
    const map = await loadLatestYuhoForCompanies(sb, [task.company_id]);
    latest = map.get(task.company_id);
  } catch (e) {
    return {
      kind: "failed",
      error_code: "unknown",
      error_message: (e as Error).message,
      article_id: task.article_id,
      cost_usd: 0,
    };
  }

  // 起票時に取った target_* と、いま取った latest が違う場合は最新化
  if (latest && latest.doc_id) {
    await sb
      .from("agent_job_tasks")
      .update({
        target_doc_id: latest.doc_id,
        target_fiscal_year: latest.fiscal_year ?? null,
        target_submitted_at: latest.submitted_at ?? null,
      })
      .eq("id", task.id);
  }

  // ---------------------------------------------------------------
  // 2) スキップ／リライト判定（実行時に再評価）
  // ---------------------------------------------------------------
  let existing = null as Awaited<
    ReturnType<typeof findExistingSalaryArticleForCompany>
  >;
  try {
    existing = await findExistingSalaryArticleForCompany(sb, task.company_id);
  } catch (e) {
    return {
      kind: "failed",
      error_code: "unknown",
      error_message: (e as Error).message,
      article_id: task.article_id,
      cost_usd: 0,
    };
  }

  const decision = decideSkipOrRewrite({
    latest,
    existing,
    rewriteIfNewerYuho: opts.rewriteIfNewerYuho,
    skipExisting: opts.skipExisting,
    runtime: true,
  });

  if (decision.kind === "skip") {
    return {
      kind: "skipped",
      reason: decision.reason,
      article_id: decision.article_id ?? task.article_id,
      cost_usd: 0,
    };
  }

  // ---------------------------------------------------------------
  // 3) 記事の用意（既存リライト or 新規ドラフト作成）
  // ---------------------------------------------------------------
  let articleId: string;
  let isRewrite = false;

  if (decision.kind === "rewrite") {
    articleId = decision.article_id;
    isRewrite = true;
    // タスク行に article_id / was_rewrite を保存しておく（途中失敗時の冪等性）
    await sb
      .from("agent_job_tasks")
      .update({
        article_id: articleId,
        was_rewrite: true,
        sections_total: SALARY_SECTIONS.length,
      })
      .eq("id", task.id);
  } else {
    // create — まず task.article_id を再利用（前回クラッシュ後の再試行対策）
    if (task.article_id) {
      // 既に作っていたドラフトを再利用
      articleId = task.article_id;
    } else {
      try {
        const defaultAuthorId = await resolveDefaultAuthorId(sb);
        articleId = await createDraftAndLink(
          sb,
          company.id,
          company.name,
          defaultAuthorId
        );
      } catch (e) {
        return {
          kind: "failed",
          error_code: "create_draft",
          error_message: (e as Error).message,
          article_id: null,
          cost_usd: 0,
        };
      }
      await sb
        .from("agent_job_tasks")
        .update({
          article_id: articleId,
          was_rewrite: false,
          sections_total: SALARY_SECTIONS.length,
        })
        .eq("id", task.id);
    }
  }

  // ---------------------------------------------------------------
  // 4) コンテキスト取得
  // ---------------------------------------------------------------
  const ctxRes = await loadSalaryArticleContext(articleId);
  if (!ctxRes.ok) {
    return {
      kind: "failed",
      error_code: "load_context",
      error_message: ctxRes.error,
      article_id: articleId,
      cost_usd: 0,
    };
  }
  const ctx = ctxRes.data;

  // ---------------------------------------------------------------
  // 4.5) 平均年収データの可用性チェック
  //   loadSalaryArticleContext は内部で findSalaryReadyHistory を通すので、
  //   ctx.history が空 = 「最新と 1 年前の両方に平均年収データなし」を意味する。
  //   このような企業は年収テンプレートでは記事を生成できないので skip する。
  // ---------------------------------------------------------------
  if (ctx.history.length === 0) {
    return {
      kind: "skipped",
      reason: "no_salary_data",
      article_id: existing?.article_id ?? null,
      cost_usd: 0,
    };
  }

  // ---------------------------------------------------------------
  // 5) 全セクションを順次生成
  // ---------------------------------------------------------------
  const htmlParts: string[] = [];
  let cumCost = 0;

  for (let i = 0; i < SALARY_SECTIONS.length; i++) {
    const sec = SALARY_SECTIONS[i];

    if (opts.isCancelRequested && (await opts.isCancelRequested())) {
      return {
        kind: "cancelled",
        article_id: articleId,
        cost_usd: cumCost,
      };
    }

    const r = await generateSection({
      sectionId: sec.id,
      ctx,
      model: opts.model,
    });
    if (!r.ok) {
      return {
        kind: "failed",
        error_code: "section_failed",
        error_message: `section ${sec.id} (${sec.title}): ${r.error}`,
        article_id: articleId,
        cost_usd: cumCost,
      };
    }

    htmlParts.push(r.data.html);
    cumCost += r.data.usage.cost_usd ?? 0;

    await sb
      .from("agent_job_tasks")
      .update({
        sections_done: i + 1,
        cost_usd: cumCost,
      })
      .eq("id", task.id);
  }

  // ---------------------------------------------------------------
  // 6) タイトル + 保存
  // ---------------------------------------------------------------
  const title = buildSalaryTitle(ctx).title;
  const body_html = htmlParts.join("\n\n").trim();

  const saveRes = await sb
    .from("articles")
    .update({
      title,
      body_html,
      body_json: null,
      status: "draft" as const,
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId);
  if (saveRes.error) {
    return {
      kind: "failed",
      error_code: "save_body",
      error_message: saveRes.error.message,
      article_id: articleId,
      cost_usd: cumCost,
    };
  }

  // ---------------------------------------------------------------
  // 7) カテゴリ確定（未設定なら salary をセット）
  //    既存記事をリライトする時は category_id が既に入っていることが多いが、
  //    レガシー記事（テンプレ生成だが category 未設定）への防御
  // ---------------------------------------------------------------
  if (!existing?.category_id) {
    try {
      await ensureSalaryCategory(sb, articleId);
    } catch (e) {
      // カテゴリ設定の失敗は致命的ではないので warn にとどめ、成功扱いで返す
      console.warn(`[processTask] ensureSalaryCategory failed: ${(e as Error).message}`);
    }
  }

  // ---------------------------------------------------------------
  // 7.5) リライトで author_id が空の場合のみデフォルト著者をセット
  //      （手動で設定された著者は尊重する）
  // ---------------------------------------------------------------
  if (isRewrite) {
    try {
      const defaultAuthorId = await resolveDefaultAuthorId(sb);
      if (defaultAuthorId) {
        await sb
          .from("articles")
          .update({ author_id: defaultAuthorId })
          .eq("id", articleId)
          .is("author_id", null);
      }
    } catch (e) {
      console.warn(
        `[processTask] default author assignment failed: ${(e as Error).message}`
      );
    }
  }

  // ---------------------------------------------------------------
  // 8) 有報自動リンク（生成元の doc_id を article_xbrl_documents に追加）
  // ---------------------------------------------------------------
  try {
    await autoLinkXbrlDocsCore(sb, articleId);
  } catch (e) {
    console.warn(`[processTask] autoLinkXbrlDocsCore failed: ${(e as Error).message}`);
  }

  return {
    kind: "succeeded",
    article_id: articleId,
    was_rewrite: isRewrite,
    cost_usd: cumCost,
  };
}

// =====================================================================
// helpers
// =====================================================================

async function createDraftAndLink(
  sb: SupabaseClient,
  companyId: string,
  companyName: string,
  defaultAuthorId: string | null
): Promise<string> {
  const ins = await sb
    .from("articles")
    .insert({
      title: `${companyName} の年収`,
      body_html: "",
      body_json: null,
      status: "draft",
      author_id: defaultAuthorId,
    })
    .select("id")
    .single();
  if (ins.error) throw new Error(`articles insert: ${ins.error.message}`);
  const articleId = (ins.data as { id: string }).id;

  const ac = await sb.from("article_companies").insert({
    article_id: articleId,
    company_id: companyId,
    display_order: 0,
  });
  if (ac.error) {
    // ロールバック相当：作成した記事を消す
    await sb.from("articles").delete().eq("id", articleId);
    throw new Error(`article_companies insert: ${ac.error.message}`);
  }
  return articleId;
}

async function ensureSalaryCategory(
  sb: SupabaseClient,
  articleId: string
): Promise<void> {
  const cat = await sb
    .from("article_categories")
    .select("id")
    .eq("slug", "salary")
    .is("parent_id", null)
    .maybeSingle();
  if (cat.error || !cat.data) {
    throw new Error(
      `salary category not found: ${cat.error?.message ?? "no row"}`
    );
  }
  const upd = await sb
    .from("articles")
    .update({ category_id: (cat.data as { id: string }).id })
    .eq("id", articleId);
  if (upd.error) throw new Error(`update category_id: ${upd.error.message}`);
}
