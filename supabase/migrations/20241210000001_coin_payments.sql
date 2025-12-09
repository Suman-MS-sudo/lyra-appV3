-- Create coin_payments table for tracking physical coin transactions
-- These are separate from online Razorpay payments which go in transactions table

CREATE TABLE IF NOT EXISTS coin_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id UUID NOT NULL REFERENCES vending_machines(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    amount_in_paisa INTEGER NOT NULL CHECK (amount_in_paisa > 0),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    dispensed BOOLEAN NOT NULL DEFAULT true,
    dispensed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes for common queries
    CONSTRAINT coin_payments_amount_check CHECK (amount_in_paisa >= 0)
);

-- Create indexes for performance
CREATE INDEX idx_coin_payments_machine_id ON coin_payments(machine_id);
CREATE INDEX idx_coin_payments_product_id ON coin_payments(product_id);
CREATE INDEX idx_coin_payments_created_at ON coin_payments(created_at DESC);
CREATE INDEX idx_coin_payments_machine_created ON coin_payments(machine_id, created_at DESC);

-- Add RLS policies
ALTER TABLE coin_payments ENABLE ROW LEVEL SECURITY;

-- Admins can view all coin payments
CREATE POLICY "Admins can view all coin payments"
    ON coin_payments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Service role can insert coin payments (for ESP32 API)
CREATE POLICY "Service role can insert coin payments"
    ON coin_payments
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Service role can update coin payments
CREATE POLICY "Service role can update coin payments"
    ON coin_payments
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Add comment
COMMENT ON TABLE coin_payments IS 'Tracks physical coin payments from vending machines (separate from online Razorpay transactions)';
