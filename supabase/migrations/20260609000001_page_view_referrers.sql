-- 流入元（参照元 referrer）を (日付, パス, ホスト) で集計する。
-- page_views は (date, path, count) で集計済みなので、別テーブルに切り出して
-- カーディナリティの増加（referrer × path）を本テーブルに閉じ込める。
--
-- 用途: GA4 と独立した自前のリファラ分析。何経由（google, twitter, etc）で
--       どのページに来ているかを可視化する。

create table public.page_view_referrers (
  date date not null,
  path text not null,
  referrer_host text not null,  -- 例: "google.com", "t.co", "(direct)", "(internal)"
  count bigint not null default 0,
  primary key (date, path, referrer_host)
);

alter table public.page_view_referrers enable row level security;

create policy "page_view_referrers_service_only" on public.page_view_referrers
  for all to service_role using (true) with check (true);

create index page_view_referrers_date_idx on public.page_view_referrers(date desc);
create index page_view_referrers_host_idx on public.page_view_referrers(referrer_host);

comment on table public.page_view_referrers is
  '(date, path, referrer_host) で集計した流入元別 PV。/api/track-view が page_views と同時に upsert する';
