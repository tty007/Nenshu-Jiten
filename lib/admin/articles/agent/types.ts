// バックエンドとUIで共有する型定義。
// _mock/data.ts の型を本ファイルへ移植して実装側はこちらを正とする。

export type AgentTemplateId = "salary";

export type AgentJobStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "cancelled"
  | "failed"
  | "paused";

export type AgentTaskStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "skipped"
  | "failed"
  | "cancelled";

export type AgentSelectionMode = "all_with_freshness" | "individual";

export type AgentFreshness =
  | "this_month"
  | "last_month"
  | "specific_month"
  | "last_3_months"
  | "last_6_months"
  | "last_12_months";

export type AgentJobOptions = {
  skipExisting: boolean;
  rewriteIfNewerYuho: boolean;
  /** 現状は gpt-4o-mini のみ。将来追加時に拡張 */
  model: "gpt-4o-mini";
  /** 1〜3 */
  concurrency: number;
  /** 任意。total_cost_usd がここを超えたら残タスクを cancelled で打ち切り */
  costCapUsd: number | null;
};

export type AgentSelectionPayloadAll = {
  mode: "all_with_freshness";
  freshness: AgentFreshness;
  /** specific_month の場合の YYYY-MM */
  monthAnchor: string | null;
};

export type AgentSelectionPayloadIndividual = {
  mode: "individual";
  companyIds: string[];
};

export type AgentSelectionPayload =
  | AgentSelectionPayloadAll
  | AgentSelectionPayloadIndividual;

export type AgentJobRow = {
  id: string;
  template_id: AgentTemplateId;
  status: AgentJobStatus;
  notes: string | null;
  total_tasks: number;
  succeeded_count: number;
  skipped_count: number;
  failed_count: number;
  cancelled_count: number;
  pending_count: number;
  running_count: number;
  total_cost_usd: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  created_by_email: string | null;
};

export type AgentTaskRow = {
  id: string;
  sequence: number;
  company_name: string;
  edinet_code: string;
  target_fiscal_year: number | null;
  status: AgentTaskStatus;
  was_rewrite: boolean;
  sections_done: number;
  sections_total: number;
  cost_usd: number;
  attempts: number;
  error_message: string | null;
  skip_reason: string | null;
  article_id: string | null;
};

export type AgentJobScopePreview = {
  totalSelected: number;
  wouldCreate: number;
  wouldRewrite: number;
  wouldSkip: number;
  estimatedCostUsd: number;
  estimatedRuntimeMinutes: number;
};

/** 1 記事あたりの想定実行秒数（GH Actions 上の wall time）。 */
export const SECONDS_PER_ARTICLE = 90;
