alter table public.telegram_transaction_template_items
add column if not exists smart_config jsonb;
