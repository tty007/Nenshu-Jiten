-- 企業基本情報の追加カラム
-- representative: 代表者の役職と氏名（XBRL から）
-- corporate_number: 法人番号 13桁（gBizINFO から）
-- capital_stock_yen: 資本金（gBizINFO から）
-- founded_at: 設立年月日（gBizINFO から）
-- fiscal_year_end_month: 決算期月（XBRL から）

alter table public.companies
  add column if not exists representative text,
  add column if not exists corporate_number text,
  add column if not exists capital_stock_yen bigint,
  add column if not exists founded_at date,
  add column if not exists fiscal_year_end_month int
    check (fiscal_year_end_month is null or fiscal_year_end_month between 1 and 12);

create unique index if not exists companies_corporate_number_uniq
  on public.companies(corporate_number) where corporate_number is not null;
