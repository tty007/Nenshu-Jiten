-- お気に入り機能：会員が企業をブックマークして /mypage/favorites で一覧できる
create table public.user_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create index user_favorites_user_id_created_idx
  on public.user_favorites(user_id, created_at desc);
create index user_favorites_company_id_idx
  on public.user_favorites(company_id);

alter table public.user_favorites enable row level security;

create policy "user_favorites_owner_all" on public.user_favorites
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
