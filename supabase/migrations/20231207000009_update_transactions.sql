-- Update transactions table to support Razorpay and multiple items per transaction

-- Add new columns for Razorpay integration and item details
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS machine_id UUID REFERENCES vending_machines(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS items JSONB;

-- Create index for Razorpay IDs for quick lookup
CREATE INDEX IF NOT EXISTS idx_transactions_razorpay_order ON transactions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_razorpay_payment ON transactions(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_machine_id ON transactions(machine_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);

-- Update RLS policies for transactions
DROP POLICY IF EXISTS "Customers can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;

CREATE POLICY "Customers can view own transactions"
  ON transactions FOR SELECT
  USING (
    auth.uid() = customer_id OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE account_type = 'admin'
    )
  );

CREATE POLICY "System can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update transactions"
  ON transactions FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE account_type = 'admin'
    )
  );

COMMENT ON COLUMN transactions.items IS 'JSONB array of {product_id, name, price, quantity}';
COMMENT ON COLUMN transactions.razorpay_order_id IS 'Razorpay order ID for tracking';
COMMENT ON COLUMN transactions.razorpay_payment_id IS 'Razorpay payment ID after successful payment';
