-- Enable row-level security for all tables accessed directly by the web app.
-- The frontend uses the Supabase anon key, so every table must enforce user ownership.

alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.contacts enable row level security;
alter table public.trips enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_splits enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.app_data enable row level security;

drop policy if exists "users see own rows" on public.wallets;
create policy "users see own rows" on public.wallets
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users see own rows" on public.categories;
create policy "users see own rows" on public.categories
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users see own rows" on public.contacts;
create policy "users see own rows" on public.contacts
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users see own rows" on public.trips;
create policy "users see own rows" on public.trips
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users see own rows" on public.transactions;
create policy "users see own rows" on public.transactions
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users see own rows" on public.budgets;
create policy "users see own rows" on public.budgets
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users see own rows" on public.goals;
create policy "users see own rows" on public.goals
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users see own rows" on public.app_data;
create policy "users see own rows" on public.app_data
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users see own rows" on public.transaction_splits;
create policy "users see own rows" on public.transaction_splits
    for all to authenticated
    using (
        exists (
            select 1
            from public.transactions
            where transactions.id = transaction_splits.transaction_id
              and transactions.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1
            from public.transactions
            where transactions.id = transaction_splits.transaction_id
              and transactions.user_id = auth.uid()
        )
    );
