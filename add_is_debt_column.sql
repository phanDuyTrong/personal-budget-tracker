-- Run this in your Supabase SQL Editor to add the is_debt column
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS is_debt BOOLEAN DEFAULT FALSE;
