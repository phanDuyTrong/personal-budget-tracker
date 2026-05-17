create table if not exists public.telegram_transaction_templates (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    trigger_text text not null,
    trigger_normalized text not null,
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, trigger_normalized)
);

create table if not exists public.telegram_transaction_template_items (
    id uuid primary key default gen_random_uuid(),
    template_id uuid not null references public.telegram_transaction_templates(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    sort_order integer not null default 0,
    type text not null check (type in ('expense', 'income', 'transfer')),
    amount numeric(12,2) not null check (amount > 0),
    wallet_id uuid references public.wallets(id) on delete set null,
    to_wallet_id uuid references public.wallets(id) on delete set null,
    category_id uuid references public.categories(id) on delete set null,
    contact_id uuid references public.contacts(id) on delete set null,
    description text,
    date_offset_days integer not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists idx_telegram_transaction_templates_user_id on public.telegram_transaction_templates(user_id);
create index if not exists idx_telegram_transaction_templates_trigger on public.telegram_transaction_templates(user_id, trigger_normalized);
create index if not exists idx_telegram_transaction_template_items_template_id on public.telegram_transaction_template_items(template_id);
create index if not exists idx_telegram_transaction_template_items_user_id on public.telegram_transaction_template_items(user_id);

alter table public.telegram_transaction_templates enable row level security;
alter table public.telegram_transaction_template_items enable row level security;

drop policy if exists "users see own rows" on public.telegram_transaction_templates;
create policy "users see own rows" on public.telegram_transaction_templates
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users see own rows" on public.telegram_transaction_template_items;
create policy "users see own rows" on public.telegram_transaction_template_items
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
