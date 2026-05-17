create table if not exists public.telegram_ai_parse_memories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_text text not null,
    normalized_text text not null,
    parser text not null check (parser in ('local', 'ai', 'template')),
    parsed_payload jsonb not null,
    transaction_id uuid references public.transactions(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists idx_telegram_ai_parse_memories_user_created
    on public.telegram_ai_parse_memories(user_id, created_at desc);

create index if not exists idx_telegram_ai_parse_memories_normalized
    on public.telegram_ai_parse_memories(user_id, normalized_text);

alter table public.telegram_ai_parse_memories enable row level security;

drop policy if exists "users see own rows" on public.telegram_ai_parse_memories;
create policy "users see own rows" on public.telegram_ai_parse_memories
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
