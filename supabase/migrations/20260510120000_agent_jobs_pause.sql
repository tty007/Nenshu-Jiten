-- =====================================================================
-- 記事制作エージェント: ジョブの一時停止対応
--
--   - status の許可値に 'paused' を追加
--   - pause_requested 列を追加（cancel_requested と並列）
--   - 既存の cancel_requested は変更しない
-- =====================================================================

-- インライン CHECK 制約を一旦外して再定義（auto-named 'agent_jobs_status_check'）
alter table public.agent_jobs
  drop constraint if exists agent_jobs_status_check;

alter table public.agent_jobs
  add constraint agent_jobs_status_check
  check (status in (
    'pending',
    'queued',
    'running',
    'completed',
    'completed_with_errors',
    'cancelled',
    'failed',
    'paused'
  ));

-- 一時停止要求フラグ（drainer がタスク境界で監視）
alter table public.agent_jobs
  add column if not exists pause_requested boolean not null default false;
