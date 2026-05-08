-- =====================================================================
-- 記事 + 記事 ↔ 企業 の多対多
--
-- ・articles: 記事本体（TipTap の HTML と JSON 両方を保存）
-- ・article_companies: 記事に紐づく企業（1 記事 = N 企業、比較記事対応）
-- ・全テーブル RLS 有効、書き込みは service_role のみ。
--   公開済み記事は anon SELECT 可（status='published' のみ）。
-- =====================================================================

create table public.articles (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default '',
  -- TipTap が生成する HTML（表示用）
  body_html   text not null default '',
  -- TipTap の構造化 JSON（再編集用、ProseMirror Doc）
  body_json   jsonb,
  status      text not null default 'draft'
              check (status in ('draft', 'published', 'archived')),
  author_id   uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_articles_status_updated
  on public.articles(status, updated_at desc);

create trigger articles_set_updated_at
  before update on public.articles
  for each row
  execute function public.set_updated_at();

comment on table public.articles is
  '管理画面で作成する編集記事。body_html を表示・body_json を再編集に使う';

-- ---------------------------------------------------------------------
-- 記事 ↔ 企業 の多対多（比較記事は N:N）
-- ---------------------------------------------------------------------
create table public.article_companies (
  article_id     uuid not null references public.articles(id) on delete cascade,
  company_id     uuid not null references public.companies(id) on delete cascade,
  display_order  smallint not null default 0,
  added_at       timestamptz not null default now(),
  primary key (article_id, company_id)
);

create index idx_article_companies_company
  on public.article_companies(company_id);

create index idx_article_companies_article_order
  on public.article_companies(article_id, display_order);

comment on table public.article_companies is
  '記事と企業の多対多。1 記事に複数企業を関連付け（比較記事対応）';

-- ---------------------------------------------------------------------
-- RLS
--   articles: published のみ anon SELECT、書き込みは service_role
--   article_companies: published 記事のジョインだけ anon SELECT
-- ---------------------------------------------------------------------
alter table public.articles          enable row level security;
alter table public.article_companies enable row level security;

create policy "articles_published_read"
  on public.articles for select
  to anon, authenticated
  using (status = 'published');

create policy "article_companies_published_read"
  on public.article_companies for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.articles a
      where a.id = article_companies.article_id and a.status = 'published'
    )
  );
