alter table public.telegram_user_links
  add column if not exists weekly_alerts_enabled boolean not null default true,
  add column if not exists weekly_alerts_last_sent_at timestamptz;
