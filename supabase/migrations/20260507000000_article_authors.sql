-- =====================================================================
-- 著者プロフィール（記事の信頼性表示・E-E-A-T 強化）
--
-- ・article_authors: 著者プロフィールマスタ。再利用可能なエンティティ。
--   将来的に /authors/{slug} 個別ページや、JSON-LD の author に展開する想定。
-- ・articles.author_id を本テーブルへ FK 化（既存カラムを利用）。
-- ・公開フラグ is_active: false の著者は anon SELECT 不可。記事に紐付き残ったまま
--   著者だけ非公開化したい運用に備えて、FK は ON DELETE SET NULL。
-- =====================================================================

create table public.article_authors (
  id              uuid primary key default gen_random_uuid(),
  -- /authors/{slug} 用。半角英数とハイフンを想定（運用は UI 側で正規化）
  slug            text not null unique,
  -- 表示名（漢字 / そのまま見出しに出す）
  name            text not null,
  -- 読み（カナ）。検索用途・JSON-LD alternateName に使う
  name_kana       text,
  -- 肩書き例：「編集長」「主任ライター」「校閲担当」
  title           text,
  -- 自己紹介（150〜400 字を想定）
  bio             text,
  avatar_url      text,
  twitter_handle  text,
  linkedin_url    text,
  website_url     text,
  -- 編集者かライターかなどの種別（将来：複数役割 → 別テーブルで N:N 拡張可能）
  is_active       boolean not null default true,
  display_order   integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_article_authors_active_order
  on public.article_authors(is_active, display_order, name);

create trigger article_authors_set_updated_at
  before update on public.article_authors
  for each row
  execute function public.set_updated_at();

comment on table public.article_authors is
  '記事の著者・編集者プロフィール（E-E-A-T 強化と公開ページの著者表示用）';

-- ---------------------------------------------------------------------
-- articles.author_id を FK 化（既存カラム）
--
-- 既存運用では author_id に auth.users.id（管理者の uid）が入っていた。
-- 本機能で article_authors への FK へ転換するため、orphan を null に正規化
-- してから FK 制約を追加する。
-- ---------------------------------------------------------------------
update public.articles a
set author_id = null
where author_id is not null
  and not exists (
    select 1 from public.article_authors aa where aa.id = a.author_id
  );

alter table public.articles
  add constraint articles_author_id_fkey
  foreign key (author_id) references public.article_authors(id)
  on delete set null;

create index if not exists idx_articles_author_id
  on public.articles(author_id);

-- ---------------------------------------------------------------------
-- RLS：active のみ anon SELECT 可。書き込みは service_role のみ。
-- ---------------------------------------------------------------------
alter table public.article_authors enable row level security;

create policy "article_authors_active_read"
  on public.article_authors for select
  to anon, authenticated
  using (is_active = true);
