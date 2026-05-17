alter table public.telegram_user_links
  alter column default_wallet_id drop not null;

alter table public.telegram_link_codes
  alter column default_wallet_id drop not null;
