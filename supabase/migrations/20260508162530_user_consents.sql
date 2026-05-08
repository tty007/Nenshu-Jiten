-- =====================================================================
-- 同意管理（広告配信ビジネス対応）
--
-- 個人情報保護法 / 改正電気通信事業法 / 特定電子メール法 に対応するため、
-- 利用者から取得した同意状態と、その付与・撤回履歴を保存する。
--
-- ・user_consents       : 現状の同意状態（per user × consent_type）。
--                          撤回した場合は granted=false に倒し、revoked_at を入れる。
--                          消し込みではなく状態保持＋ログでエビデンスを残す方針。
-- ・user_consent_logs   : 監査用の append-only ログ。誰がいつどの状態に変えたか。
--                          policy_version / source（"signup", "mypage" 等）も保持し、
--                          後日「どの版のポリシーに同意したか」を証明できるようにする。
--
-- consent_type は次の 4 種類を想定。
--   - marketing_email         : メール広告（オプトイン必須／特定電子メール法）
--   - personalized_ads        : 自社内オンサイトのパーソナライズ広告
--   - third_party_advertising : 第三者広告ネットワークへの送信
--   - data_sharing            : DMP 等への第三者提供
-- =====================================================================

create table public.user_consents (
  user_id        uuid not null references auth.users(id) on delete cascade,
  consent_type   text not null check (
    consent_type in (
      'marketing_email',
      'personalized_ads',
      'third_party_advertising',
      'data_sharing'
    )
  ),
  granted        boolean not null,
  granted_at     timestamptz not null default now(),
  revoked_at     timestamptz,
  -- 同意取得時点でユーザーに提示していたポリシー版（例：'2026-04-30'）
  policy_version text,
  -- 同意の発生源 UI（'signup' / 'mypage' / 'admin' / 'reconsent_modal' 等）
  source         text,
  primary key (user_id, consent_type)
);

comment on table public.user_consents is
  '広告配信・メール広告・第三者提供 等の同意状態。撤回は granted=false + revoked_at で履歴を残す';

-- granted=true のユーザだけ広告配信対象に絞り込む用途の部分インデックス
create index idx_user_consents_type_granted
  on public.user_consents(consent_type, granted)
  where granted = true;

-- ---------------------------------------------------------------------
-- 監査ログ：append-only。RLS で本人読み取りのみ可。書き込みは server 側のみ
-- ---------------------------------------------------------------------
create table public.user_consent_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  consent_type   text not null,
  action         text not null check (action in ('granted', 'revoked', 'updated')),
  policy_version text,
  source         text,
  created_at     timestamptz not null default now()
);

create index idx_user_consent_logs_user_time
  on public.user_consent_logs(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- RLS：本人のみ自分の同意状態を SELECT 可。書き込みは service_role 経由
--       （server action でログイン中ユーザの uid を確認のうえ insert / upsert）。
-- ---------------------------------------------------------------------
alter table public.user_consents enable row level security;
alter table public.user_consent_logs enable row level security;

create policy "user_consents_self_read"
  on public.user_consents for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_consent_logs_self_read"
  on public.user_consent_logs for select
  to authenticated
  using (auth.uid() = user_id);
