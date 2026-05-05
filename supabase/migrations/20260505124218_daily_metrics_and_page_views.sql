-- 管理ダッシュボードの過去推移を可視化するため、毎日のスナップショットを保存する。
-- daily_metrics: 1日 1行（cron で snapshot script 実行）
-- page_views: クライアント計測したページビューを (日付, パス) で集計

create table public.daily_metrics (
  date date primary key,
  users_total int not null default 0,
  users_new int not null default 0,
  users_active_24h int not null default 0,
  users_active_7d int not null default 0,
  favorites_total int not null default 0,
  favorites_new int not null default 0,
  companies_total int not null default 0,
  companies_updated int not null default 0,
  page_views int,
  unique_paths int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger daily_metrics_set_updated_at
  before update on public.daily_metrics
  for each row execute function public.set_updated_at();

alter table public.daily_metrics enable row level security;
-- service_role のみ書込・読込（admin ダッシュボードからは service_role で読む）
create policy "daily_metrics_service_only" on public.daily_metrics
  for all to service_role using (true) with check (true);

create table public.page_views (
  date date not null,
  path text not null,
  count bigint not null default 0,
  primary key (date, path)
);

alter table public.page_views enable row level security;
create policy "page_views_service_only" on public.page_views
  for all to service_role using (true) with check (true);

create index page_views_date_idx on public.page_views(date desc);
