-- Lets one RFID card be assigned to any number of machines (not just zero or
-- one). rfid_cards.machine_id stays in the schema for backward compatibility
-- (older rows, any code still reading it directly) but is no longer the
-- source of truth going forward -- the app now reads/writes card->machine
-- assignments exclusively through this join table.
--
-- Scoping semantics (see resolveCardMachines()/matching logic in
-- rfid-payment, machine-cards-sync, and the [id] routes):
--   - >=1 row in rfid_card_machines for a card -> card works ONLY on those
--     specific machines, regardless of organization_id.
--   - 0 rows + organization_id set -> card works on every machine belonging
--     to that organization (unchanged "org-wide" behavior).
--   - 0 rows + organization_id NULL -> true any-machine wildcard
--     (admin-only, spans customers; unchanged).
CREATE TABLE IF NOT EXISTS rfid_card_machines (
    card_id UUID NOT NULL REFERENCES rfid_cards(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES vending_machines(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (card_id, machine_id)
);

CREATE INDEX IF NOT EXISTS idx_rfid_card_machines_machine_id ON rfid_card_machines(machine_id);

-- Backfill: every card that already had a single machine_id gets one row here.
INSERT INTO rfid_card_machines (card_id, machine_id)
SELECT id, machine_id FROM rfid_cards WHERE machine_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE rfid_card_machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all rfid card machine assignments"
    ON rfid_card_machines
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage rfid card machine assignments"
    ON rfid_card_machines
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

CREATE POLICY "Service role can manage rfid card machine assignments"
    ON rfid_card_machines
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE rfid_card_machines IS 'Many-to-many: which machines an RFID card is restricted to. Empty = falls back to organization_id-wide or true-wildcard scoping.';
