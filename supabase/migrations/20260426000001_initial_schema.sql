-- =====================================================================
-- 初期スキーマ
-- 表示系: industries / companies / financial_metrics / industry_averages
-- 生データ層: raw_xbrl_documents
-- RLS: 表示系4テーブルは anon SELECT 許可、書き込みは service_role のみ
--      raw_xbrl_documents はポリシー無し → service_role のみアクセス可
-- =====================================================================

-- 拡張機能
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- updated_at 自動更新トリガー関数
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 業界マスタ
-- ---------------------------------------------------------------------
create table public.industries (
  code        text primary key,
  name        text not null,
  parent_code text references public.industries(code)
);

comment on table public.industries is '東証33業種ベースの業界マスタ';

-- ---------------------------------------------------------------------
-- 企業マスタ
-- ---------------------------------------------------------------------
create table public.companies (
  id                     uuid primary key default gen_random_uuid(),
  edinet_code            text not null unique,
  securities_code        text,
  name                   text not null,
  name_kana              text,
  industry_code          text references public.industries(code),
  listed_market          text,
  description            text,
  summary                text,
  summary_generated_at   timestamptz,
  summary_source_doc_id  text,
  website_url            text,
  headquarters           text,
  founded_year           int,
  logo_url               text,
  cover_image_url        text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_companies_industry_code on public.companies(industry_code);
create index idx_companies_securities_code on public.companies(securities_code);

create trigger companies_set_updated_at
  before update on public.companies
  for each row
  execute function public.set_updated_at();

comment on table public.companies is '企業マスタ（EDINETコードでユニーク）';

-- ---------------------------------------------------------------------
-- 年度別の財務・人事指標（整形済み）
-- ---------------------------------------------------------------------
create table public.financial_metrics (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies(id) on delete cascade,
  fiscal_year            int  not null,
  average_annual_salary  int,
  average_age            numeric(4,1),
  average_tenure_years   numeric(4,1),
  employee_count         int,
  female_manager_ratio   numeric(5,2),
  average_overtime_hours numeric(5,2),
  revenue                bigint,
  operating_income       bigint,
  ordinary_income        bigint,
  net_income             bigint,
  doc_id                 text,
  submitted_at           timestamptz,
  created_at             timestamptz not null default now(),
  unique (company_id, fiscal_year)
);

create index idx_financial_metrics_company_year
  on public.financial_metrics(company_id, fiscal_year desc);

comment on table public.financial_metrics is '企業×年度の整形済み指標。XBRL から ETL で投入';

-- ---------------------------------------------------------------------
-- 業界平均（事前集計）
-- ---------------------------------------------------------------------
create table public.industry_averages (
  industry_code            text not null references public.industries(code),
  fiscal_year              int  not null,
  avg_annual_salary        int,
  avg_tenure_years         numeric(4,1),
  avg_employee_count       int,
  avg_female_manager_ratio numeric(5,2),
  avg_overtime_hours       numeric(5,2),
  sample_size              int  not null default 0,
  primary key (industry_code, fiscal_year)
);

comment on table public.industry_averages is '業界×年度の平均値。financial_metrics から再集計';

-- ---------------------------------------------------------------------
-- 生データ層：EDINET から取得した有報メタ情報 + パース後の JSON
-- ZIP本体は Supabase Storage に置く想定（storage_path で参照）
-- ---------------------------------------------------------------------
create table public.raw_xbrl_documents (
  id              uuid primary key default gen_random_uuid(),
  edinet_code     text not null,
  doc_id          text not null unique,
  ordinance_code  text,
  form_code       text,
  doc_type_code   text,
  fiscal_year     int,
  period_start    date,
  period_end      date,
  submitted_at    timestamptz not null,
  filer_name      text,
  raw_xbrl        jsonb,
  storage_path    text,
  parsed_at       timestamptz,
  parse_error     text,
  created_at      timestamptz not null default now()
);

create index idx_raw_xbrl_submitted_at on public.raw_xbrl_documents(submitted_at desc);
create index idx_raw_xbrl_edinet_code on public.raw_xbrl_documents(edinet_code);

comment on table public.raw_xbrl_documents is 'EDINETから取得したXBRLの生データ層。フロントエンドからは参照しない';

-- ---------------------------------------------------------------------
-- RLS: 表示系4テーブルは anon SELECT 許可、書き込みは service_role のみ
-- raw_xbrl_documents はポリシー無し → service_role 以外は完全に拒否される
-- ---------------------------------------------------------------------
alter table public.industries          enable row level security;
alter table public.companies           enable row level security;
alter table public.financial_metrics   enable row level security;
alter table public.industry_averages   enable row level security;
alter table public.raw_xbrl_documents  enable row level security;

create policy "industries_public_read"
  on public.industries for select
  to anon, authenticated
  using (true);

create policy "companies_public_read"
  on public.companies for select
  to anon, authenticated
  using (true);

create policy "financial_metrics_public_read"
  on public.financial_metrics for select
  to anon, authenticated
  using (true);

create policy "industry_averages_public_read"
  on public.industry_averages for select
  to anon, authenticated
  using (true);

-- raw_xbrl_documents には select/insert/update ポリシーを作らない
-- service_role キーは RLS をバイパスするため、ETLスクリプトからのみ書き込み可能
