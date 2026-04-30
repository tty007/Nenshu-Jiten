-- 1. user_profiles テーブル新設
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  birth_year int,
  gender text,
  prefecture text,
  career_status text,
  salary_band text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nickname_length
    check (nickname is null or char_length(nickname) between 1 and 30),
  constraint birth_year_range
    check (birth_year is null or birth_year between 1920 and (extract(year from now())::int - 10)),
  constraint gender_enum
    check (gender is null or gender in ('male','female','other','no_answer')),
  constraint career_status_enum
    check (career_status is null or career_status in ('student','working')),
  constraint salary_band_enum
    check (salary_band is null or salary_band in (
      'under_300','300_400','400_500','500_600','600_700','700_800',
      '800_900','900_1000','1000_1200','1200_1500','1500_2000','2000_3000','over_3000'
    )),
  constraint prefecture_enum
    check (prefecture is null or prefecture in (
      '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
      '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
      '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県',
      '滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
      '鳥取県','島根県','岡山県','広島県','山口県',
      '徳島県','香川県','愛媛県','高知県',
      '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'
    ))
);

alter table public.user_profiles enable row level security;

create policy "user_profiles_owner_all" on public.user_profiles
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- 2. 既存 profiles.display_name → user_profiles.nickname へ移行
insert into public.user_profiles (user_id, nickname)
select id, display_name from public.profiles
where display_name is not null
on conflict (user_id) do nothing;

-- 3. handle_new_user トリガー更新（display_name 参照を撤去 + email サインアップ時のみ user_profiles 行を作成）
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  if new.raw_user_meta_data ? 'display_name' then
    insert into public.user_profiles (user_id, nickname)
    values (new.id, nullif(new.raw_user_meta_data->>'display_name', ''))
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

-- 4. profiles.display_name を撤去
alter table public.profiles drop column display_name;
