-- Add dispensed tracking fields to transactions table
-- This allows ESP32 to mark payments as "dispensed" after physical product delivery

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS dispensed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dispensed_at TIMESTAMPTZ;

-- Add index for faster queries by ESP32 (looking for non-dispensed paid transactions)
CREATE INDEX IF NOT EXISTS idx_transactions_dispensed 
ON transactions(machine_id, payment_status, dispensed) 
WHERE payment_status = 'paid' AND dispensed = false;

-- Add comment for documentation
COMMENT ON COLUMN transactions.dispensed IS 'True when ESP32 has physically dispensed the products';
COMMENT ON COLUMN transactions.dispensed_at IS 'Timestamp when ESP32 marked the transaction as dispensed';
