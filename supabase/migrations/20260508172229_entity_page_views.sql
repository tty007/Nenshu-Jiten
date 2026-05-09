-- =====================================================================
-- 企業ページ・記事ページのエンティティ別 PV 集計。
--
-- 既存 page_views テーブルはパス文字列ベースで /companies/* を 1 バケツに
-- 集約してしまうため、後の機能（人気企業ランキング、人気記事一覧 等）に
-- 使えない。エンティティ ID を一次キーにすることで slug 変更にも耐える。
--
-- 集計粒度：日次 × エンティティ。アトミック +1 用の RPC を併設。
-- 個人を識別する情報は一切持たないため Cookie 同意は不要（自社内集計）。
-- =====================================================================

create table public.company_page_views (
  date       date not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  count      bigint not null default 0,
  primary key (date, company_id)
);

create index company_page_views_company_date_idx
  on public.company_page_views(company_id, date desc);
create index company_page_views_date_idx
  on public.company_page_views(date desc);

create table public.article_page_views (
  date       date not null,
  article_id uuid not null references public.articles(id) on delete cascade,
  count      bigint not null default 0,
  primary key (date, article_id)
);

create index article_page_views_article_date_idx
  on public.article_page_views(article_id, date desc);
create index article_page_views_date_idx
  on public.article_page_views(date desc);

comment on table public.company_page_views is
  '企業ページの日次 PV 集計（エンティティキー）。slug 変更耐性あり';
comment on table public.article_page_views is
  '記事ページの日次 PV 集計（エンティティキー）。slug 変更耐性あり';

-- ---------------------------------------------------------------------
-- アトミック +1 関数。security definer で service_role 以外も RPC 可だが
-- 実運用では server action 側で admin client を使うため anon からは呼ばない。
-- ---------------------------------------------------------------------
create or replace function public.increment_company_view(
  p_company_id uuid,
  p_date       date
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.company_page_views (date, company_id, count)
  values (p_date, p_company_id, 1)
  on conflict (date, company_id)
  do update set count = public.company_page_views.count + 1;
$$;

create or replace function public.increment_article_view(
  p_article_id uuid,
  p_date       date
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.article_page_views (date, article_id, count)
  values (p_date, p_article_id, 1)
  on conflict (date, article_id)
  do update set count = public.article_page_views.count + 1;
$$;

-- ---------------------------------------------------------------------
-- RLS：service_role のみ。集計データ自体に個人情報はないが、表示は
-- アプリケーション側の集約 API（"閲覧 N 回" 等）でラップする想定で、
-- 直接の anon 読み取りは閉じておく。
-- ---------------------------------------------------------------------
alter table public.company_page_views enable row level security;
alter table public.article_page_views enable row level security;

create policy "company_page_views_service_only"
  on public.company_page_views for all to service_role
  using (true) with check (true);

create policy "article_page_views_service_only"
  on public.article_page_views for all to service_role
  using (true) with check (true);

revoke execute on function public.increment_company_view(uuid, date) from anon, authenticated;
revoke execute on function public.increment_article_view(uuid, date) from anon, authenticated;
