-- =====================================================================
-- 記事制作エージェント: ジョブ + タスクのキューと、ワーカーが安全に
-- タスクをリースする RPC。
--
-- 設計の要点:
--   - 1 ジョブ = ある条件で展開された企業集合（年収テンプレで N 社ぶん）
--   - 1 タスク = 1 企業（処理単位は記事 1 本ぶん）
--   - ワーカー (GitHub Actions 上の Node スクリプト) は claim_next_task RPC
--     でタスクを 1 件取得。`for update skip locked` で複数ワーカーが衝突しない。
--   - 進捗カウンタは agent_jobs に非正規化（一覧画面が即時描画できる）。
--   - 書き込み・読み取り共に service_role 経由のみ。RLS は有効化のみ。
-- =====================================================================

create table public.agent_jobs (
  id                  uuid primary key default gen_random_uuid(),
  template_id         text not null
                      check (template_id in ('salary')),
  status              text not null default 'pending'
                      check (status in (
                        'pending',
                        'queued',
                        'running',
                        'completed',
                        'completed_with_errors',
                        'cancelled',
                        'failed'
                      )),
  -- ジョブ起票時の対象選択方法のスナップショット
  selection_mode      text not null
                      check (selection_mode in ('all_with_freshness','individual')),
  selection_payload   jsonb not null default '{}'::jsonb,
  options             jsonb not null default '{}'::jsonb,

  -- UI が即時描画できるよう非正規化したカウンタ
  total_tasks         int  not null default 0,
  pending_count       int  not null default 0,
  running_count       int  not null default 0,
  succeeded_count     int  not null default 0,
  skipped_count       int  not null default 0,
  failed_count        int  not null default 0,
  cancelled_count     int  not null default 0,
  total_cost_usd      numeric(10,6) not null default 0,

  created_by          uuid,                  -- auth.users(id)。FK は付けない（auth スキーマへの依存を避ける）
  created_by_email    text,                  -- 表示用に冗長保存
  notes               text,                  -- 80 字までの短いラベル

  cancel_requested    boolean not null default false,

  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  finished_at         timestamptz,
  last_dispatched_at  timestamptz,
  last_heartbeat_at   timestamptz,

  updated_at          timestamptz not null default now()
);

create index idx_agent_jobs_status_created
  on public.agent_jobs(status, created_at desc);

create index idx_agent_jobs_active
  on public.agent_jobs(status)
  where status in ('pending','queued','running');

create trigger agent_jobs_set_updated_at
  before update on public.agent_jobs
  for each row
  execute function public.set_updated_at();

comment on table public.agent_jobs is
  '記事制作エージェントのジョブ。1 ジョブ = N 企業の処理単位を束ねる';

-- ---------------------------------------------------------------------
-- agent_job_tasks: 1 企業 = 1 タスク
-- ---------------------------------------------------------------------
create table public.agent_job_tasks (
  id                    uuid primary key default gen_random_uuid(),
  job_id                uuid not null references public.agent_jobs(id) on delete cascade,
  sequence              int  not null,                                -- 0始まり、決定論的順序
  company_id            uuid not null references public.companies(id) on delete cascade,

  status                text not null default 'pending'
                        check (status in (
                          'pending', 'running', 'succeeded',
                          'skipped', 'failed', 'cancelled'
                        )),
  skip_reason           text,                                          -- 'same_yuho' / 'no_metrics' / 'rewrite_disabled' / 'cost_cap_reached' / ...

  -- 起票時に取得した「最新有報」スナップショット。実行時に再評価する。
  target_doc_id         text,
  target_fiscal_year    int,
  target_submitted_at   timestamptz,

  -- 実行結果
  article_id            uuid references public.articles(id) on delete set null,
  was_rewrite           boolean not null default false,
  sections_done         int  not null default 0,
  sections_total        int  not null default 0,
  cost_usd              numeric(10,6) not null default 0,
  error_code            text,
  error_message         text,
  attempts              int  not null default 0,
  max_attempts          int  not null default 3,

  -- ワーカーリース（claim_next_task が更新する）
  locked_by             text,                       -- GitHub run id 等
  locked_until          timestamptz,                -- 期限切れで別ワーカーが奪取可能

  created_at            timestamptz not null default now(),
  started_at            timestamptz,
  finished_at           timestamptz,

  unique (job_id, company_id)
);

create index idx_agent_job_tasks_job_status_seq
  on public.agent_job_tasks(job_id, status, sequence);

-- ワーカーの pickup 用：pending と (running かつリース切れ) を高速に抽出
create index idx_agent_job_tasks_pickup
  on public.agent_job_tasks(job_id, sequence)
  where status in ('pending','running');

create index idx_agent_job_tasks_company
  on public.agent_job_tasks(company_id);

comment on table public.agent_job_tasks is
  'エージェントジョブの企業単位タスク。FOR UPDATE SKIP LOCKED でワーカーが安全にリース';

-- ---------------------------------------------------------------------
-- claim_next_task: ワーカーが 1 件取得して running にする
--
-- - 同じ job_id 内で sequence が最も若い未処理タスクを 1 件取得
-- - status='pending' または (status='running' かつ locked_until < now)
-- - status を 'running' に更新、locked_by / locked_until / attempts++ を記録
-- - 取れなければ null（rows = 0）
--
-- SECURITY DEFINER: service_role からの呼び出しを前提だが、関数自体は誰が
-- 呼んでも DB 上は同じ動作になる（書き込み権限が無ければ UPDATE 失敗）。
-- ---------------------------------------------------------------------
create or replace function public.claim_next_task(
  p_job_id uuid,
  p_lock_owner text,
  p_lease_seconds int default 900
)
returns table (
  id                    uuid,
  job_id                uuid,
  sequence              int,
  company_id            uuid,
  status                text,
  target_doc_id         text,
  target_fiscal_year    int,
  target_submitted_at   timestamptz,
  article_id            uuid,
  attempts              int,
  max_attempts          int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- pending / リース切れ running を 1 件ロック
  select t.id into v_id
  from public.agent_job_tasks t
  where t.job_id = p_job_id
    and (
      t.status = 'pending'
      or (t.status = 'running' and (t.locked_until is null or t.locked_until < now()))
    )
  order by t.sequence asc
  limit 1
  for update skip locked;

  if v_id is null then
    return;
  end if;

  update public.agent_job_tasks t
  set status        = 'running',
      locked_by     = p_lock_owner,
      locked_until  = now() + make_interval(secs => p_lease_seconds),
      attempts      = t.attempts + 1,
      started_at    = coalesce(t.started_at, now())
  where t.id = v_id;

  return query
  select t.id,
         t.job_id,
         t.sequence,
         t.company_id,
         t.status,
         t.target_doc_id,
         t.target_fiscal_year,
         t.target_submitted_at,
         t.article_id,
         t.attempts,
         t.max_attempts
  from public.agent_job_tasks t
  where t.id = v_id;
end;
$$;

comment on function public.claim_next_task(uuid, text, int) is
  'ワーカーがエージェントタスクを 1 件原子的にリースする。FOR UPDATE SKIP LOCKED で並走安全。';

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.agent_jobs       enable row level security;
alter table public.agent_job_tasks  enable row level security;

-- 公開読み取りは想定しないが、明示的にポリシー無し（service_role のみ）。
-- 将来のためにコメントだけ残す。
comment on table public.agent_jobs is
  '記事制作エージェントのジョブ。1 ジョブ = N 企業の処理単位を束ねる。書き込み・読み取りとも service_role のみ。';
comment on table public.agent_job_tasks is
  'エージェントジョブの企業単位タスク。FOR UPDATE SKIP LOCKED でワーカーが安全にリース。書き込み・読み取りとも service_role のみ。';
