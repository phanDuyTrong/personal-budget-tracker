-- Initial Supabase schema for the shipping web app.
-- This mirrors the tables used by web/src/hooks/useApi.js.

create extension if not exists pgcrypto;

create table if not exists public.wallets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    type text not null default 'checking',
    balance numeric(12, 2) not null default 0,
    color text,
    deleted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.categories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    icon text,
    color text,
    type text not null check (type in ('income', 'expense')),
    parent_id uuid references public.categories(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    email text,
    phone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.trips (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    destination text,
    start_date date not null,
    end_date date not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    wallet_id uuid references public.wallets(id) on delete set null,
    to_wallet_id uuid references public.wallets(id) on delete set null,
    category_id uuid references public.categories(id) on delete set null,
    contact_id uuid references public.contacts(id) on delete set null,
    trip_id uuid references public.trips(id) on delete set null,
    amount numeric(12, 2) not null,
    type text not null check (type in ('income', 'expense', 'transfer')),
    description text,
    date date not null,
    is_recurring boolean not null default false,
    is_reviewed boolean not null default false,
    is_debt boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.transaction_splits (
    id uuid primary key default gen_random_uuid(),
    transaction_id uuid not null references public.transactions(id) on delete cascade,
    category_id uuid references public.categories(id) on delete set null,
    amount numeric(12, 2) not null,
    note text,
    created_at timestamptz not null default now()
);

create table if not exists public.budgets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    category_id uuid not null references public.categories(id) on delete cascade,
    amount numeric(12, 2) not null,
    period text not null check (period in ('monthly', 'weekly', 'biweekly')),
    rollover boolean not null default false,
    start_date date not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.goals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    wallet_id uuid references public.wallets(id) on delete set null,
    name text not null,
    target_amount numeric(12, 2) not null,
    current_amount numeric(12, 2) not null default 0,
    deadline date,
    status text not null default 'active' check (status in ('active', 'completed', 'archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.app_data (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    key text not null,
    value jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, key)
);

create index if not exists idx_wallets_user_id on public.wallets(user_id);
create index if not exists idx_categories_user_id on public.categories(user_id);
create index if not exists idx_categories_parent_id on public.categories(parent_id);
create index if not exists idx_contacts_user_id on public.contacts(user_id);
create index if not exists idx_trips_user_id on public.trips(user_id);
create index if not exists idx_transactions_user_id_date on public.transactions(user_id, date desc);
create index if not exists idx_transactions_wallet_id on public.transactions(wallet_id);
create index if not exists idx_transactions_to_wallet_id on public.transactions(to_wallet_id);
create index if not exists idx_transactions_category_id on public.transactions(category_id);
create index if not exists idx_transactions_contact_id on public.transactions(contact_id);
create index if not exists idx_transactions_trip_id on public.transactions(trip_id);
create index if not exists idx_transaction_splits_transaction_id on public.transaction_splits(transaction_id);
create index if not exists idx_budgets_user_id on public.budgets(user_id);
create index if not exists idx_goals_user_id on public.goals(user_id);
