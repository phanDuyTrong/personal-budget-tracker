-- Telegram bot integration for transaction capture.
-- Edge Functions use these tables to link Telegram accounts and avoid duplicate webhook inserts.

create table if not exists public.telegram_user_links (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    telegram_user_id text not null,
    chat_id text not null,
    username text,
    first_name text,
    last_name text,
    default_wallet_id uuid not null references public.wallets(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id),
    unique (telegram_user_id)
);

create table if not exists public.telegram_link_codes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    default_wallet_id uuid not null references public.wallets(id) on delete cascade,
    code text not null unique,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists public.telegram_transaction_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    telegram_user_id text not null,
    chat_id text not null,
    source_message_id text,
    bot_message_id text not null,
    transaction_id uuid not null references public.transactions(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (chat_id, bot_message_id)
);

create table if not exists public.telegram_processed_updates (
    update_id bigint primary key,
    processed_at timestamptz not null default now()
);

create index if not exists idx_telegram_link_codes_code on public.telegram_link_codes(code);
create index if not exists idx_telegram_link_codes_user_id on public.telegram_link_codes(user_id);
create index if not exists idx_telegram_user_links_user_id on public.telegram_user_links(user_id);
create index if not exists idx_telegram_user_links_telegram_user_id on public.telegram_user_links(telegram_user_id);
create index if not exists idx_telegram_transaction_events_user_id on public.telegram_transaction_events(user_id);
create index if not exists idx_telegram_transaction_events_transaction_id on public.telegram_transaction_events(transaction_id);

alter table public.telegram_user_links enable row level security;
alter table public.telegram_link_codes enable row level security;
alter table public.telegram_transaction_events enable row level security;
alter table public.telegram_processed_updates enable row level security;

drop policy if exists "users see own rows" on public.telegram_user_links;
create policy "users see own rows" on public.telegram_user_links
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users see own rows" on public.telegram_link_codes;
create policy "users see own rows" on public.telegram_link_codes
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users see own rows" on public.telegram_transaction_events;
create policy "users see own rows" on public.telegram_transaction_events
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- processed_updates intentionally has no authenticated policy; only service-role functions use it.
