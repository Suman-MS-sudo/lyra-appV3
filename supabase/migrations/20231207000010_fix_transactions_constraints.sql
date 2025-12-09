-- Fix transactions table constraints for Razorpay integration
-- This migration makes legacy columns nullable to support new multi-item JSONB approach

-- Make old single-product columns nullable (legacy system)
ALTER TABLE transactions 
  ALTER COLUMN product_id DROP NOT NULL,
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN vending_machine_id DROP NOT NULL,
  ALTER COLUMN amount DROP NOT NULL;

-- Add dispensed column if not exists (for tracking dispensed items)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS dispensed BOOLEAN DEFAULT false;

-- Update comments to clarify new vs old fields
COMMENT ON COLUMN transactions.product_id IS 'DEPRECATED: Use items JSONB for multi-product support';
COMMENT ON COLUMN transactions.user_id IS 'DEPRECATED: Use customer_id instead';
COMMENT ON COLUMN transactions.vending_machine_id IS 'DEPRECATED: Use machine_id instead';
COMMENT ON COLUMN transactions.amount IS 'DEPRECATED: Use total_amount instead';
COMMENT ON COLUMN transactions.customer_id IS 'New field: Customer who made the purchase';
COMMENT ON COLUMN transactions.machine_id IS 'New field: Machine that processed the transaction';
COMMENT ON COLUMN transactions.total_amount IS 'New field: Total amount for multi-item purchases';
COMMENT ON COLUMN transactions.items IS 'JSONB array of {product_id, name, price, quantity}';
COMMENT ON COLUMN transactions.dispensed IS 'Whether items have been physically dispensed';

-- Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_dispensed ON transactions(dispensed) WHERE dispensed = false;

-- Grant necessary permissions
GRANT SELECT, INSERT ON transactions TO authenticated;
GRANT ALL ON transactions TO service_role;
