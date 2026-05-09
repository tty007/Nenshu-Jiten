import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  findExistingSalaryArticlesBulk,
  loadLatestYuhoForCompanies,
  decideSkipOrRewrite,
} from "./skip-rewrite";
import type {
  AgentFreshness,
  AgentJobOptions,
  AgentJobRow,
  AgentJobScopePreview,
  AgentJobStatus,
  AgentSelectionMode,
  AgentTaskRow,
  AgentTemplateId,
} from "./types";
import { SECONDS_PER_ARTICLE } from "./types";
import { SALARY_TOTAL_EST_COST_USD } from "@/lib/admin/articles/salary-template/sections";

// =====================================================================
// 鮮度ウィンドウの計算（JST 基準）
// =====================================================================

/**
 * 鮮度フィルタの開始 / 終了タイムスタンプ (ISO) を返す。
 * 暦月系は JST の月境界、ローリング系は now() からの相対。
 *
 * end が null の場合は「上限なし（= now まで）」を意味する。
 */
export function computeFreshnessWindow(
  freshness: AgentFreshness,
  monthAnchor: string | null
): { start: string; end: string | null } {
  const now = new Date();
  if (
    freshness === "this_month" ||
    freshness === "last_month" ||
    freshness === "specific_month"
  ) {
    const jst = jstParts(now);
    let baseYear = jst.year;
    let baseMonth = jst.month; // 1-12
    if (freshness === "last_month") {
      if (baseMonth === 1) {
        baseYear -= 1;
        baseMonth = 12;
      } else {
        baseMonth -= 1;
      }
    } else if (freshness === "specific_month") {
      if (!monthAnchor || !/^\d{4}-\d{2}$/.test(monthAnchor)) {
        throw new Error(
          "specific_month には YYYY-MM 形式の monthAnchor が必要です"
        );
      }
      const [yy, mm] = monthAnchor.split("-").map((s) => Number(s));
      baseYear = yy;
      baseMonth = mm;
    }
    const start = jstMonthStartIso(baseYear, baseMonth);
    const next =
      baseMonth === 12
        ? { y: baseYear + 1, m: 1 }
        : { y: baseYear, m: baseMonth + 1 };
    const end = jstMonthStartIso(next.y, next.m);
    return { start, end };
  }

  // ローリング系
  const months =
    freshness === "last_3_months"
      ? 3
      : freshness === "last_6_months"
      ? 6
      : 12; // last_12_months
  const startD = new Date(now.getTime());
  startD.setMonth(startD.getMonth() - months);
  return { start: startD.toISOString(), end: null };
}

function jstParts(d: Date): { year: number; month: number; day: number } {
  // "en-CA" は YYYY-MM-DD で固定の文字列を返す
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const [y, m, dd] = s.split("-").map((x) => Number(x));
  return { year: y, month: m, day: dd };
}

function jstMonthStartIso(year: number, month: number): string {
  // YYYY-MM-01T00:00:00+09:00
  const yy = String(year).padStart(4, "0");
  const mm = String(month).padStart(2, "0");
  return `${yy}-${mm}-01T00:00:00+09:00`;
}

// =====================================================================
// 対象企業の解決
// =====================================================================

export type ResolvedTargetCompany = {
  id: string;
  edinet_code: string;
  name: string;
};

/**
 * 「全社（鮮度フィルタ）」モードでの対象企業を resolve。
 * financial_metrics で各企業の最新提出日を取り、ウィンドウ内に入る企業を返す。
 *
 * パフォーマンス：financial_metrics は (company_id, fiscal_year) ユニークだが、
 * 数十万行のオーダーになり得る。distinct on を使った 1 ショットの取得は
 * Supabase の REST 経由では効きづらいので、submitted_at desc で取って JS 側で
 * company_id ごとに最初に来た行を採用する単純アルゴリズムにしている。
 */
export async function resolveCompaniesByFreshness(
  sb: SupabaseClient,
  freshness: AgentFreshness,
  monthAnchor: string | null
): Promise<ResolvedTargetCompany[]> {
  const { start, end } = computeFreshnessWindow(freshness, monthAnchor);

  // 1) ウィンドウ内に提出日がある financial_metrics を新しい順に取得
  let q = sb
    .from("financial_metrics")
    .select("company_id, doc_id, submitted_at")
    .gte("submitted_at", start)
    .not("doc_id", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(20000);
  if (end) q = q.lt("submitted_at", end);
  const fm = await q;
  if (fm.error) throw new Error(`fm: ${fm.error.message}`);

  // 各 company_id の最新行のみ採用
  const seen = new Set<string>();
  const companyIds: string[] = [];
  for (const r of fm.data ?? []) {
    const cid = r.company_id as string;
    if (seen.has(cid)) continue;
    seen.add(cid);
    companyIds.push(cid);
  }
  if (companyIds.length === 0) return [];

  // 2) companies マスタから edinet/name を一括取得
  const c = await sb
    .from("companies")
    .select("id, edinet_code, name")
    .in("id", companyIds);
  if (c.error) throw new Error(`companies: ${c.error.message}`);
  const byId = new Map<string, ResolvedTargetCompany>();
  for (const row of c.data ?? []) {
    byId.set(row.id as string, {
      id: row.id as string,
      edinet_code: row.edinet_code as string,
      name: row.name as string,
    });
  }
  // EDINET コード昇順でソート（タスクの sequence を決定論的にするため）
  const out: ResolvedTargetCompany[] = companyIds
    .map((cid) => byId.get(cid))
    .filter((x): x is ResolvedTargetCompany => Boolean(x))
    .sort((a, b) => a.edinet_code.localeCompare(b.edinet_code));
  return out;
}

/** 個別検索モード — 与えた companyId 配列を resolve（並び順は EDINET 昇順） */
export async function resolveCompaniesByIds(
  sb: SupabaseClient,
  companyIds: string[]
): Promise<ResolvedTargetCompany[]> {
  if (companyIds.length === 0) return [];
  const c = await sb
    .from("companies")
    .select("id, edinet_code, name")
    .in("id", companyIds);
  if (c.error) throw new Error(`companies: ${c.error.message}`);
  return ((c.data ?? []) as ResolvedTargetCompany[]).sort((a, b) =>
    a.edinet_code.localeCompare(b.edinet_code)
  );
}

// =====================================================================
// プレビュー
// =====================================================================

/**
 * モーダルの「対象プレビュー」用：対象企業を resolve し、
 * スキップ判定をバルクでかけて (create / rewrite / skip) を集計。
 */
export async function computeJobScopePreview(args: {
  sb: SupabaseClient;
  selectionMode: AgentSelectionMode;
  freshness?: AgentFreshness | null;
  monthAnchor?: string | null;
  companyIds?: string[];
  options: AgentJobOptions;
}): Promise<AgentJobScopePreview> {
  const { sb, selectionMode, freshness, monthAnchor, companyIds, options } =
    args;

  let companies: ResolvedTargetCompany[];
  if (selectionMode === "all_with_freshness") {
    if (!freshness) throw new Error("freshness が必要です");
    companies = await resolveCompaniesByFreshness(sb, freshness, monthAnchor ?? null);
  } else {
    companies = await resolveCompaniesByIds(sb, companyIds ?? []);
  }

  const cids = companies.map((c) => c.id);
  const [latestMap, existingMap] = await Promise.all([
    loadLatestYuhoForCompanies(sb, cids),
    findExistingSalaryArticlesBulk(sb, cids),
  ]);

  let wouldCreate = 0;
  let wouldRewrite = 0;
  let wouldSkip = 0;
  for (const c of companies) {
    const decision = decideSkipOrRewrite({
      latest: latestMap.get(c.id),
      existing: existingMap.get(c.id),
      rewriteIfNewerYuho: options.rewriteIfNewerYuho,
      skipExisting: options.skipExisting,
    });
    if (decision.kind === "create") wouldCreate++;
    else if (decision.kind === "rewrite") wouldRewrite++;
    else wouldSkip++;
  }

  // 判定で「skip」になっているものは実行されない（skipExisting / rewriteIfNewerYuho を
  // 既に decideSkipOrRewrite が反映している）
  const willActuallyRun = wouldCreate + wouldRewrite;
  const estimatedCostUsd = willActuallyRun * SALARY_TOTAL_EST_COST_USD;
  const estimatedRuntimeMinutes = Math.round(
    (willActuallyRun * SECONDS_PER_ARTICLE) /
      Math.max(1, options.concurrency) /
      60
  );

  return {
    totalSelected: companies.length,
    wouldCreate,
    wouldRewrite,
    wouldSkip,
    estimatedCostUsd,
    estimatedRuntimeMinutes,
  };
}

// =====================================================================
// 一覧 / 詳細
// =====================================================================

export async function listAgentJobs(
  args: { limit?: number; status?: AgentJobStatus | null } = {}
): Promise<AgentJobRow[]> {
  const sb = createSupabaseAdminClient();
  let q = sb
    .from("agent_jobs")
    .select(
      [
        "id",
        "template_id",
        "status",
        "notes",
        "total_tasks",
        "succeeded_count",
        "skipped_count",
        "failed_count",
        "cancelled_count",
        "pending_count",
        "running_count",
        "total_cost_usd",
        "created_at",
        "started_at",
        "finished_at",
        "created_by_email",
      ].join(",")
    )
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 50);
  if (args.status) q = q.eq("status", args.status);
  const r = await q;
  if (r.error) throw new Error(`listAgentJobs: ${r.error.message}`);
  return (r.data ?? []) as unknown as AgentJobRow[];
}

export async function getAgentJobDetail(
  jobId: string
): Promise<AgentJobRow | null> {
  const sb = createSupabaseAdminClient();
  const r = await sb
    .from("agent_jobs")
    .select(
      [
        "id",
        "template_id",
        "status",
        "notes",
        "total_tasks",
        "succeeded_count",
        "skipped_count",
        "failed_count",
        "cancelled_count",
        "pending_count",
        "running_count",
        "total_cost_usd",
        "created_at",
        "started_at",
        "finished_at",
        "created_by_email",
      ].join(",")
    )
    .eq("id", jobId)
    .maybeSingle();
  if (r.error) throw new Error(`getAgentJobDetail: ${r.error.message}`);
  if (!r.data) return null;
  return r.data as unknown as AgentJobRow;
}

export async function listAgentJobTasks(
  jobId: string,
  args: { limit?: number; offset?: number; status?: string | null } = {}
): Promise<AgentTaskRow[]> {
  const sb = createSupabaseAdminClient();
  const limit = Math.max(1, Math.min(args.limit ?? 200, 500));
  const offset = Math.max(0, args.offset ?? 0);

  let q = sb
    .from("agent_job_tasks")
    .select(
      `
      id,
      sequence,
      status,
      was_rewrite,
      sections_done,
      sections_total,
      cost_usd,
      attempts,
      error_message,
      skip_reason,
      article_id,
      target_fiscal_year,
      companies!inner(id, edinet_code, name)
    `
    )
    .eq("job_id", jobId)
    .order("sequence", { ascending: true })
    .range(offset, offset + limit - 1);
  if (args.status) q = q.eq("status", args.status);

  const r = await q;
  if (r.error) throw new Error(`listAgentJobTasks: ${r.error.message}`);

  type Row = {
    id: string;
    sequence: number;
    status: AgentTaskRow["status"];
    was_rewrite: boolean;
    sections_done: number;
    sections_total: number;
    cost_usd: number;
    attempts: number;
    error_message: string | null;
    skip_reason: string | null;
    article_id: string | null;
    target_fiscal_year: number | null;
    companies:
      | { id: string; edinet_code: string; name: string }
      | { id: string; edinet_code: string; name: string }[]
      | null;
  };
  const out: AgentTaskRow[] = ((r.data ?? []) as Row[]).map((row) => {
    const c = Array.isArray(row.companies) ? row.companies[0] : row.companies;
    return {
      id: row.id,
      sequence: row.sequence,
      company_name: c?.name ?? "(unknown)",
      edinet_code: c?.edinet_code ?? "",
      target_fiscal_year: row.target_fiscal_year,
      status: row.status,
      was_rewrite: row.was_rewrite,
      sections_done: row.sections_done,
      sections_total: row.sections_total,
      cost_usd: Number(row.cost_usd),
      attempts: row.attempts,
      error_message: row.error_message,
      skip_reason: row.skip_reason,
      article_id: row.article_id,
    };
  });
  return out;
}

/** ダッシュボードの「アクティブなジョブ」「今月生成された記事」用の集計 */
export async function getAgentDashboardStats(): Promise<{
  activeJobs: number;
  articlesThisMonth: number;
}> {
  const sb = createSupabaseAdminClient();

  const active = await sb
    .from("agent_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["queued", "running"]);
  const activeJobs = active.count ?? 0;

  const { start } = computeFreshnessWindow("this_month", null);
  const articles = await sb
    .from("agent_job_tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "succeeded")
    .gte("finished_at", start);
  const articlesThisMonth = articles.count ?? 0;

  return { activeJobs, articlesThisMonth };
}

/** options.json の zod 等価チェック（手書き）— サーバーアクションで使う */
export function normalizeAgentJobOptions(
  raw: Partial<AgentJobOptions> | null | undefined
): AgentJobOptions {
  return {
    skipExisting: raw?.skipExisting ?? true,
    rewriteIfNewerYuho: raw?.rewriteIfNewerYuho ?? true,
    model: "gpt-4o-mini",
    concurrency: clampInt(raw?.concurrency ?? 1, 1, 3),
    costCapUsd:
      typeof raw?.costCapUsd === "number" && raw.costCapUsd > 0
        ? raw.costCapUsd
        : null,
  };
}

function clampInt(v: number, min: number, max: number): number {
  const n = Math.floor(Number(v));
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export type AgentTemplateMeta = {
  id: AgentTemplateId;
  title: string;
  description: string;
  est_cost_usd: number;
};
export const AGENT_TEMPLATES: AgentTemplateMeta[] = [
  {
    id: "salary",
    title: "年収テンプレート",
    description:
      "EDINET 有報の経年データから年収記事を生成。15 セクション、約 $0.0074/社",
    est_cost_usd: SALARY_TOTAL_EST_COST_USD,
  },
];
