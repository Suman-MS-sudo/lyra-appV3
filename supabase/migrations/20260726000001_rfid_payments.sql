-- Create rfid_cards and rfid_payments tables for RFID prepaid-balance vending
-- Mirrors the coin_payments pattern: RFID is a distinct payment mode with its
-- own dedicated tables, separate from coin_payments and transactions (online).

-- Prepaid balance cards. A card is a physical RFID tag identified by its
-- hex UID. Balance is stored in paisa (integer) to avoid float rounding.
CREATE TABLE IF NOT EXISTS rfid_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid TEXT NOT NULL UNIQUE, -- RFID tag UID, hex string e.g. "A1B2C3D4"
    holder_name TEXT,
    balance_paisa INTEGER NOT NULL DEFAULT 0 CHECK (balance_paisa >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rfid_cards_uid ON rfid_cards(uid);
CREATE INDEX idx_rfid_cards_organization_id ON rfid_cards(organization_id);

-- Individual tap-to-pay transactions, one row per successful dispense.
CREATE TABLE IF NOT EXISTS rfid_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    machine_id UUID NOT NULL REFERENCES vending_machines(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES rfid_cards(id) ON DELETE CASCADE,
    card_uid TEXT NOT NULL,
    amount_in_paisa INTEGER NOT NULL CHECK (amount_in_paisa > 0),
    balance_after_paisa INTEGER NOT NULL CHECK (balance_after_paisa >= 0),
    dispensed BOOLEAN NOT NULL DEFAULT true,
    dispensed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rfid_payments_machine_id ON rfid_payments(machine_id);
CREATE INDEX idx_rfid_payments_card_id ON rfid_payments(card_id);
CREATE INDEX idx_rfid_payments_created_at ON rfid_payments(created_at DESC);
CREATE INDEX idx_rfid_payments_machine_created ON rfid_payments(machine_id, created_at DESC);

-- Trigger to keep updated_at current on balance/holder changes
CREATE OR REPLACE FUNCTION set_rfid_cards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rfid_cards_updated_at
    BEFORE UPDATE ON rfid_cards
    FOR EACH ROW
    EXECUTE FUNCTION set_rfid_cards_updated_at();

-- RLS
ALTER TABLE rfid_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfid_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all rfid cards"
    ON rfid_cards
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage rfid cards"
    ON rfid_cards
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Service role can manage rfid cards"
    ON rfid_cards
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admins can view all rfid payments"
    ON rfid_payments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Service role can insert rfid payments"
    ON rfid_payments
    FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "Service role can update rfid payments"
    ON rfid_payments
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Per-machine RFID mode toggle (mirrors implicit coin/online toggles, but
-- explicit here since RFID needs a UI switch on the admin machine form)
ALTER TABLE vending_machines
    ADD COLUMN IF NOT EXISTS rfid_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON TABLE rfid_cards IS 'Prepaid-balance RFID cards used for tap-to-pay vending';
COMMENT ON TABLE rfid_payments IS 'Tracks RFID card payments from vending machines (separate from coin_payments and transactions)';
COMMENT ON COLUMN vending_machines.rfid_enabled IS 'Whether this machine accepts RFID card payments';
