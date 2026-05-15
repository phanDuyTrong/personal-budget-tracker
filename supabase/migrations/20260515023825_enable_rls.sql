-- Enable row-level security for all tables accessed directly by the web app.
-- The frontend uses the Supabase anon key, so every table must enforce user ownership.

alter table if exists public.wallets enable row level security;
alter table if exists public.categories enable row level security;
alter table if exists public.contacts enable row level security;
alter table if exists public.trips enable row level security;
alter table if exists public.transactions enable row level security;
alter table if exists public.transaction_splits enable row level security;
alter table if exists public.budgets enable row level security;
alter table if exists public.goals enable row level security;
alter table if exists public.app_data enable row level security;

-- Replace older permissive/public policies with a single authenticated-only owner policy per table.
drop policy if exists "users_own_accounts" on public.wallets;
drop policy if exists "users see own rows" on public.wallets;
create policy "users see own rows" on public.wallets
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users_own_categories" on public.categories;
drop policy if exists "users see own rows" on public.categories;
create policy "users see own rows" on public.categories
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users_own_contacts" on public.contacts;
drop policy if exists "users see own rows" on public.contacts;
create policy "users see own rows" on public.contacts
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Users can manage their own trips" on public.trips;
drop policy if exists "users see own rows" on public.trips;
create policy "users see own rows" on public.trips
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users_own_transactions" on public.transactions;
drop policy if exists "users see own rows" on public.transactions;
create policy "users see own rows" on public.transactions
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users_own_budgets" on public.budgets;
drop policy if exists "users see own rows" on public.budgets;
create policy "users see own rows" on public.budgets
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "users_own_goals" on public.goals;
drop policy if exists "users see own rows" on public.goals;
create policy "users see own rows" on public.goals
    for all to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

do $$
begin
    if to_regclass('public.app_data') is not null then
        execute 'drop policy if exists "users see own rows" on public.app_data';
        execute 'create policy "users see own rows" on public.app_data for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
    end if;
end $$;

drop policy if exists "users_own_splits" on public.transaction_splits;
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
