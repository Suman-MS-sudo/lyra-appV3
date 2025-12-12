-- Clean up old transaction columns and update RLS policies
-- This migration removes deprecated columns after migration to new Razorpay schema

-- Step 1: Drop old RLS policies that depend on user_id
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can create their own transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can update transactions" ON transactions;

-- Step 2: Create new RLS policies using customer_id instead of user_id
CREATE POLICY "Customers can view own transactions"
  ON transactions FOR SELECT
  USING (
    auth.uid() = customer_id OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE account_type = 'admin' OR role = 'admin'
    )
  );

CREATE POLICY "Customers can create own transactions"
  ON transactions FOR INSERT
  WITH CHECK (
    auth.uid() = customer_id OR customer_id IS NULL
  );

CREATE POLICY "System can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update transactions"
  ON transactions FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE account_type = 'admin' OR role = 'admin'
    )
  );

CREATE POLICY "Admins can delete transactions"
  ON transactions FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE account_type = 'admin' OR role = 'admin'
    )
  );

-- Step 3: Drop old columns that are no longer used
ALTER TABLE transactions 
  DROP COLUMN IF EXISTS user_id CASCADE,
  DROP COLUMN IF EXISTS product_id CASCADE,
  DROP COLUMN IF EXISTS vending_machine_id CASCADE,
  DROP COLUMN IF EXISTS amount CASCADE;

-- Step 4: Make new columns NOT NULL (for data integrity)
-- First, ensure any existing null values are handled
UPDATE transactions 
SET machine_id = vending_machine_id 
WHERE machine_id IS NULL AND vending_machine_id IS NOT NULL;

UPDATE transactions 
SET total_amount = amount 
WHERE total_amount IS NULL AND amount IS NOT NULL;

-- Now make them NOT NULL
ALTER TABLE transactions
  ALTER COLUMN machine_id SET NOT NULL,
  ALTER COLUMN total_amount SET NOT NULL,
  ALTER COLUMN payment_status SET NOT NULL;

-- Step 5: Add helpful comments
COMMENT ON COLUMN transactions.machine_id IS 'FK to vending_machines - identifies which machine the transaction occurred on';
COMMENT ON COLUMN transactions.customer_id IS 'FK to profiles - identifies the customer (can be NULL for guest/coin payments)';
COMMENT ON COLUMN transactions.total_amount IS 'Total transaction amount in rupees';
COMMENT ON COLUMN transactions.items IS 'JSONB array of purchased items: [{product_id, name, price, quantity, stock}]';
COMMENT ON COLUMN transactions.payment_status IS 'Payment status: pending, paid, failed';
COMMENT ON COLUMN transactions.razorpay_order_id IS 'Razorpay order ID for online payments';
COMMENT ON COLUMN transactions.razorpay_payment_id IS 'Razorpay payment ID after successful payment';

-- Step 6: Ensure proper indexes exist
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

-- Add check constraint for total_amount
ALTER TABLE transactions 
  ADD CONSTRAINT transactions_total_amount_check CHECK (total_amount >= 0);
