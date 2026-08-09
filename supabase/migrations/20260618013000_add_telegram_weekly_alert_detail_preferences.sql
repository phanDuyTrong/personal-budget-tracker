alter table public.telegram_user_links
  add column if not exists weekly_alerts_budget_enabled boolean not null default true,
  add column if not exists weekly_alerts_goal_enabled boolean not null default true,
  add column if not exists weekly_alerts_inactivity_enabled boolean not null default false,
  add column if not exists weekly_alerts_inactivity_days integer not null default 7;
