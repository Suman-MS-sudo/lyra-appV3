-- Fix organization billing tables to use UUID instead of TEXT
-- Run this in Supabase SQL Editor

-- Drop tables (CASCADE will drop dependent objects like triggers)
DROP TABLE IF EXISTS organization_payments CASCADE;
DROP TABLE IF EXISTS organization_invoices CASCADE;

-- Recreate with UUID columns
CREATE TABLE organization_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  
  -- Billing Period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Amounts (in paisa for precision)
  total_coin_transactions INTEGER NOT NULL DEFAULT 0,
  total_amount_paisa BIGINT NOT NULL DEFAULT 0,
  amount_paid_paisa BIGINT NOT NULL DEFAULT 0,
  amount_due_paisa BIGINT NOT NULL DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
  
  -- Payment Details
  payment_method TEXT,
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

CREATE TABLE organization_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES organization_invoices(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
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

-- Indexes
CREATE INDEX idx_org_invoices_org_id ON organization_invoices(organization_id);
CREATE INDEX idx_org_invoices_status ON organization_invoices(status);
CREATE INDEX idx_org_invoices_period ON organization_invoices(period_start, period_end);
CREATE INDEX idx_org_invoices_invoice_number ON organization_invoices(invoice_number);
CREATE INDEX idx_org_payments_invoice_id ON organization_payments(invoice_id);
CREATE INDEX idx_org_payments_org_id ON organization_payments(organization_id);
CREATE INDEX idx_org_payments_razorpay_order ON organization_payments(razorpay_order_id);

-- Recreate trigger function and trigger
CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' THEN
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

CREATE TRIGGER trigger_update_invoice_on_payment
  AFTER INSERT OR UPDATE ON organization_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_on_payment();

-- RLS Policies
ALTER TABLE organization_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_payments ENABLE ROW LEVEL SECURITY;

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

GRANT ALL ON organization_invoices TO authenticated;
GRANT ALL ON organization_payments TO authenticated;
