-- Identify and fix imported or broken transactions 
-- where a destination wallet was provided, but the type was wrongly set as 'expense'

UPDATE public.transactions 
SET type = 'transfer'
WHERE to_wallet_id IS NOT NULL AND type != 'transfer';
