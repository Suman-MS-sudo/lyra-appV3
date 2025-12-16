-- Organization Billing System
-- Tracks coin payment invoices and payments from organizations

-- Organization Invoices Table
CREATE TABLE IF NOT EXISTS organization_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  
  -- Billing Period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Amounts (in paisa for precision)
  total_coin_transactions INTEGER NOT NULL DEFAULT 0,
  total_amount_paisa BIGINT NOT NULL DEFAULT 0, -- Total coin payments in this period
  amount_paid_paisa BIGINT NOT NULL DEFAULT 0, -- Amount paid by organization
  amount_due_paisa BIGINT NOT NULL DEFAULT 0, -- Remaining balance
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
  
  -- Payment Details
  payment_method TEXT, -- 'razorpay', 'manual', etc.
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  paid_at TIMESTAMPTZ,
  
  -- Email tracking
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  last_reminder_sent_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization Payments Table (for payment history)
CREATE TABLE IF NOT EXISTS organization_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES organization_invoices(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  
  -- Payment details
  amount_paisa BIGINT NOT NULL,
  payment_method TEXT NOT NULL,
  
  -- Razorpay details
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'refunded')),
  
  -- Metadata
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_invoices_org_id ON organization_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invoices_status ON organization_invoices(status);
CREATE INDEX IF NOT EXISTS idx_org_invoices_period ON organization_invoices(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_org_invoices_invoice_number ON organization_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_org_payments_invoice_id ON organization_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_org_payments_org_id ON organization_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_payments_razorpay_order ON organization_payments(razorpay_order_id);

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  prefix TEXT := 'INV';
  year TEXT := TO_CHAR(NOW(), 'YYYY');
  month TEXT := TO_CHAR(NOW(), 'MM');
  sequence_num INTEGER;
  invoice_num TEXT;
BEGIN
  -- Get the count of invoices this month
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM organization_invoices
  WHERE invoice_number LIKE prefix || '-' || year || month || '%';
  
  -- Format: INV-YYYYMM-0001
  invoice_num := prefix || '-' || year || month || '-' || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Drop old version of function if exists
DROP FUNCTION IF EXISTS calculate_invoice_amounts(UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS calculate_invoice_amounts(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

-- Function to calculate invoice amounts from coin payments
-- Parameter is UUID matching profiles.organization_id type
-- SECURITY DEFINER bypasses RLS policies
CREATE OR REPLACE FUNCTION calculate_invoice_amounts(
  p_organization_id UUID,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS TABLE(
  total_transactions BIGINT,
  total_amount_paisa BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_transactions,
    COALESCE(SUM(cp.amount_in_paisa), 0)::BIGINT as total_amount_paisa
  FROM coin_payments cp
  INNER JOIN vending_machines vm ON cp.machine_id = vm.id
  INNER JOIN profiles p ON (vm.customer_id)::UUID = p.id
  WHERE p.organization_id = p_organization_id
    AND cp.created_at >= p_period_start
    AND cp.created_at < p_period_end
    AND cp.dispensed = true; -- Only count successful transactions
END;
$$;

-- Function to auto-update invoice on payment
CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' THEN
    -- Update invoice amounts
    UPDATE organization_invoices
    SET 
      amount_paid_paisa = amount_paid_paisa + NEW.amount_paisa,
      amount_due_paisa = GREATEST(amount_due_paisa - NEW.amount_paisa, 0),
      status = CASE 
        WHEN amount_due_paisa - NEW.amount_paisa <= 0 THEN 'paid'
        ELSE status 
      END,
      paid_at = CASE 
        WHEN amount_due_paisa - NEW.amount_paisa <= 0 THEN NOW()
        ELSE paid_at
      END,
      razorpay_payment_id = COALESCE(razorpay_payment_id, NEW.razorpay_payment_id),
      updated_at = NOW()
    WHERE id = NEW.invoice_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice when payment is successful
DROP TRIGGER IF EXISTS trigger_update_invoice_on_payment ON organization_payments;
CREATE TRIGGER trigger_update_invoice_on_payment
  AFTER INSERT OR UPDATE ON organization_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_on_payment();

-- RLS Policies
ALTER TABLE organization_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage all organization invoices" ON organization_invoices;
DROP POLICY IF EXISTS "Super customers can view their organization invoices" ON organization_invoices;
DROP POLICY IF EXISTS "Admins can manage all organization payments" ON organization_payments;
DROP POLICY IF EXISTS "Super customers can view their organization payments" ON organization_payments;

-- Admins can see and manage all invoices
CREATE POLICY "Admins can manage all organization invoices"
  ON organization_invoices
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Super customers can view their organization's invoices
CREATE POLICY "Super customers can view their organization invoices"
  ON organization_invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND organization_invoices.organization_id = profiles.organization_id
      AND profiles.account_type = 'super_customer'
    )
  );

-- Admins can manage all payments
CREATE POLICY "Admins can manage all organization payments"
  ON organization_payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Super customers can view their organization's payments
CREATE POLICY "Super customers can view their organization payments"
  ON organization_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND organization_payments.organization_id = profiles.organization_id
      AND profiles.account_type = 'super_customer'
    )
  );

-- Grant permissions
GRANT ALL ON organization_invoices TO authenticated;
GRANT ALL ON organization_payments TO authenticated;

-- Comments for documentation
COMMENT ON TABLE organization_invoices IS 'Monthly invoices for organization coin payments';
COMMENT ON TABLE organization_payments IS 'Payment records for organization invoices';
COMMENT ON FUNCTION generate_invoice_number() IS 'Generates unique invoice numbers in format INV-YYYYMM-0001';
COMMENT ON FUNCTION calculate_invoice_amounts(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Calculates total coin payment amounts for an organization in a period';
