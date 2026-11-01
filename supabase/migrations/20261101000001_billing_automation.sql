-- Billing automation & correctness
--  * due dates + overdue marking
--  * coin totals include machines owned by the organization itself (not only by its members)
--  * payment trigger credits an invoice once (only on the transition to 'success')
--  * collision-free invoice numbers
--  * one invoice per organization per period
--  * billing_runs log for the monthly auto-run

-- ── Due date ──────────────────────────────────────────────────
ALTER TABLE organization_invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
UPDATE organization_invoices SET due_date = created_at + INTERVAL '30 days' WHERE due_date IS NULL;
ALTER TABLE organization_invoices ALTER COLUMN due_date SET DEFAULT (NOW() + INTERVAL '30 days');
CREATE INDEX IF NOT EXISTS idx_org_invoices_due ON organization_invoices(status, due_date);

-- ── One live invoice per org per period (skipped with a notice if old duplicates exist) ──
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM organization_invoices WHERE status <> 'cancelled'
    GROUP BY organization_id, period_start HAVING COUNT(*) > 1
  ) THEN
    RAISE NOTICE 'Duplicate invoices exist for some organization/period; unique index not created. Cancel the duplicates and re-run.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_org_invoices_org_period
      ON organization_invoices(organization_id, period_start) WHERE status <> 'cancelled';
  END IF;
END $$;

-- ── Coin totals: org-owned machines + machines assigned to org members ──
CREATE OR REPLACE FUNCTION calculate_invoice_amounts(
  p_organization_id UUID,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ
)
RETURNS TABLE(total_transactions BIGINT, total_amount_paisa BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT COUNT(*)::BIGINT, COALESCE(SUM(cp.amount_in_paisa), 0)::BIGINT
  FROM coin_payments cp
  JOIN vending_machines vm ON vm.id = cp.machine_id
  WHERE cp.created_at >= p_period_start
    AND cp.created_at < p_period_end
    AND cp.dispensed = true
    AND (
      vm.customer_id::text = p_organization_id::text
      OR vm.customer_id::text IN (SELECT p.id::text FROM profiles p WHERE p.organization_id = p_organization_id)
    );
END;
$$;

-- ── Credit an invoice once: only when a payment becomes 'success' ──
CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'success' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'success') THEN
    UPDATE organization_invoices
    SET
      amount_paid_paisa = amount_paid_paisa + NEW.amount_paisa,
      amount_due_paisa = GREATEST(amount_due_paisa - NEW.amount_paisa, 0),
      status = CASE WHEN amount_due_paisa - NEW.amount_paisa <= 0 THEN 'paid' ELSE status END,
      paid_at = CASE WHEN amount_due_paisa - NEW.amount_paisa <= 0 THEN NOW() ELSE paid_at END,
      payment_method = COALESCE(payment_method, NEW.payment_method),
      razorpay_payment_id = COALESCE(razorpay_payment_id, NEW.razorpay_payment_id),
      updated_at = NOW()
    WHERE id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Invoice numbers: INV-YYYYMM-0001, next free number (safe after deletions, serialised) ──
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  ym TEXT := TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYYMM');
  next_num INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('generate_invoice_number'));
  SELECT COALESCE(MAX(NULLIF(split_part(invoice_number, '-', 3), '')::INTEGER), 0) + 1
    INTO next_num
    FROM organization_invoices
   WHERE invoice_number LIKE 'INV-' || ym || '-%';
  RETURN 'INV-' || ym || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ── Overdue marking (called daily by the billing cron) ──
CREATE OR REPLACE FUNCTION mark_overdue_invoices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INTEGER;
BEGIN
  UPDATE organization_invoices
     SET status = 'overdue', updated_at = NOW()
   WHERE status = 'pending' AND amount_due_paisa > 0 AND due_date < NOW();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ── Run log ──
CREATE TABLE IF NOT EXISTS billing_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triggered_by TEXT NOT NULL,              -- 'cron' or the admin's email
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  invoices_created INTEGER NOT NULL DEFAULT 0,
  invoices_skipped INTEGER NOT NULL DEFAULT 0,
  invoices_failed INTEGER NOT NULL DEFAULT 0,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  overdue_marked INTEGER NOT NULL DEFAULT 0,
  reminders_sent INTEGER NOT NULL DEFAULT 0,
  details JSONB
);
CREATE INDEX IF NOT EXISTS idx_billing_runs_run_at ON billing_runs(run_at DESC);
ALTER TABLE billing_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read billing runs" ON billing_runs;
CREATE POLICY "Admins can read billing runs" ON billing_runs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

COMMENT ON TABLE billing_runs IS 'Log of monthly invoice generation / overdue / reminder runs';
COMMENT ON FUNCTION mark_overdue_invoices() IS 'Flags pending invoices past their due date as overdue; returns rows changed';

-- ── Monthly coin totals per organization (IST months) for the billing console ──
CREATE OR REPLACE FUNCTION coin_collection_summary(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS TABLE(organization_id UUID, month DATE, coins BIGINT, amount_paisa BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(o.id, p.organization_id) AS organization_id,
    date_trunc('month', cp.created_at AT TIME ZONE 'Asia/Kolkata')::date AS month,
    COUNT(*)::BIGINT AS coins,
    COALESCE(SUM(cp.amount_in_paisa), 0)::BIGINT AS amount_paisa
  FROM coin_payments cp
  JOIN vending_machines vm ON vm.id = cp.machine_id
  LEFT JOIN organizations o ON o.id::text = vm.customer_id::text
  LEFT JOIN profiles p ON p.id::text = vm.customer_id::text
  WHERE cp.dispensed = true AND cp.created_at >= p_from AND cp.created_at < p_to
  GROUP BY 1, 2;
$$;

-- These run with elevated rights: only the server (service role) may call them
REVOKE ALL ON FUNCTION coin_collection_summary(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION coin_collection_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
REVOKE ALL ON FUNCTION calculate_invoice_amounts(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION calculate_invoice_amounts(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
REVOKE ALL ON FUNCTION mark_overdue_invoices() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_overdue_invoices() TO service_role;
