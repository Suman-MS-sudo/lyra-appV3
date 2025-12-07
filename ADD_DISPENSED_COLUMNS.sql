-- Add dispensed tracking columns to transactions table
-- Copy and paste this into Supabase SQL Editor: https://supabase.com/dashboard/project/fjghhrubobqwplvokszz/sql

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS dispensed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dispensed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Create index for fast ESP32 queries
CREATE INDEX IF NOT EXISTS idx_transactions_pending_dispense 
ON transactions(machine_id, payment_status, dispensed) 
WHERE payment_status = 'paid' AND dispensed = false;

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
AND column_name IN ('dispensed', 'dispensed_at', 'organization_id', 'machine_id');

