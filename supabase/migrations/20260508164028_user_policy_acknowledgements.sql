-- =====================================================================
-- ユーザーがどのバージョンのプライバシーポリシー / 利用規約を確認したか
-- を記録する。改定があった場合に再同意モーダルを発火させるための土台。
--
-- ・user_id PK：1 ユーザに 1 行（最新のみ保持）。履歴詳細は user_consent_logs
--   の policy_version で別途追跡できるため、ここでは状態のみ持つ。
-- ・version は CURRENT_POLICY_VERSION（lib/profile/consents.ts）と比較する。
--   不一致なら未確認として扱い、モーダルを表示する。
-- =====================================================================

create table public.user_policy_acknowledgements (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  policy_version   text not null,
  acknowledged_at  timestamptz not null default now()
);

comment on table public.user_policy_acknowledgements is
  '各ユーザが最後に確認したプライバシーポリシー版。再同意モーダルの発火判定に使う';

alter table public.user_policy_acknowledgements enable row level security;

create policy "user_policy_ack_self_read"
  on public.user_policy_acknowledgements for select
  to authenticated
  using (auth.uid() = user_id);
