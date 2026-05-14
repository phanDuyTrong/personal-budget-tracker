-- Migration: Add trip_id and destination columns
-- Run this in Supabase SQL Editor

-- 1. Add destination to trips table
ALTER TABLE trips 
ADD COLUMN IF NOT EXISTS destination TEXT;

-- 2. Add trip_id FK to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id) ON DELETE SET NULL;

-- 3. Index for fast queries by trip_id
CREATE INDEX IF NOT EXISTS idx_transactions_trip_id ON transactions(trip_id);
