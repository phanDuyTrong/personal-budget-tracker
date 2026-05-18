alter table public.telegram_transaction_events
    add column if not exists source_text text;

create table if not exists public.telegram_pending_transaction_drafts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    telegram_user_id text not null,
    chat_id text not null,
    source_message_id text,
    source_text text not null,
    parsed_payload jsonb not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (telegram_user_id, chat_id)
);

create index if not exists idx_telegram_pending_transaction_drafts_user_id
    on public.telegram_pending_transaction_drafts(user_id);

create index if not exists idx_telegram_pending_transaction_drafts_expires_at
    on public.telegram_pending_transaction_drafts(expires_at);

alter table public.telegram_pending_transaction_drafts enable row level security;

drop policy if exists "users see own rows" on public.telegram_pending_transaction_drafts;
create policy "users see own rows" on public.telegram_pending_transaction_drafts
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
