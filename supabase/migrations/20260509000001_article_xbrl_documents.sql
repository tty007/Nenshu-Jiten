-- =====================================================================
-- 記事 ↔ 有価証券報告書 (EDINET 書類) の多対多リンク
--
-- 目的:
--   記事がどの有報データから生成 / 参照しているかを構造化して保持する。
--   毎年の更新サイクルで「FY2024 で生成した記事を、FY2025 が出たら再生成
--   するべき」という判定を SQL 1 本でできるようにする。
--
-- raw_xbrl_documents.doc_id への FK は付けない（articles と raw_xbrl_documents
-- のライフサイクルは独立。raw を消しても articles の参照は残してよい）。
-- 代わりに表示で必要なメタ情報を冗長に持つ。
-- =====================================================================

create table public.article_xbrl_documents (
  article_id        uuid not null references public.articles(id) on delete cascade,
  doc_id            text not null,                          -- EDINET 書類 ID
  edinet_code       text,                                   -- 企業の EDINET コード（冗長保持）
  fiscal_year       int,                                    -- 対象年度
  submitted_at      timestamptz,                            -- 提出日
  filer_name        text,                                   -- 表示用の提出者名
  display_order     int  not null default 0,
  created_at        timestamptz not null default now(),
  primary key (article_id, doc_id)
);

create index idx_article_xbrl_documents_article
  on public.article_xbrl_documents(article_id, display_order);

create index idx_article_xbrl_documents_doc
  on public.article_xbrl_documents(doc_id);

create index idx_article_xbrl_documents_fiscal_year
  on public.article_xbrl_documents(fiscal_year)
  where fiscal_year is not null;

create index idx_article_xbrl_documents_edinet
  on public.article_xbrl_documents(edinet_code)
  where edinet_code is not null;

comment on table public.article_xbrl_documents is
  '記事と有価証券報告書（EDINET 書類）の多対多リンク。テンプレ生成時に自動で挿入され、毎年の最新化チェックに使う。';

-- ---------------------------------------------------------------------
-- RLS
--   articles と同様、anon / authenticated は SELECT のみ許可。
--   書き込みは service_role のみ（admin Server Action 経由）。
-- ---------------------------------------------------------------------
alter table public.article_xbrl_documents enable row level security;

create policy "article_xbrl_documents_public_read"
  on public.article_xbrl_documents for select
  to anon, authenticated
  using (true);
