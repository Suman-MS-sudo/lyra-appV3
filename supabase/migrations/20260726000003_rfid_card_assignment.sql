-- Let an RFID card be assigned to a specific customer/organization, a specific
-- machine, and a specific product at creation time — mirrors how a vending
-- machine itself is assigned to an organization + products in machine_products.
--
-- machine_id: if set, the card can only be used on that machine (server
--             rejects taps from any other machine_id with WRONG_MACHINE).
-- product_id: if set, this product's price is charged instead of whatever
--             the tapped machine's default/first product would resolve to.
-- Both stay optional — an unassigned card keeps working exactly as before
-- (any machine, machine's own default product).

ALTER TABLE rfid_cards
    ADD COLUMN IF NOT EXISTS machine_id UUID REFERENCES vending_machines(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rfid_cards_machine_id ON rfid_cards(machine_id);
CREATE INDEX IF NOT EXISTS idx_rfid_cards_product_id ON rfid_cards(product_id);

COMMENT ON COLUMN rfid_cards.machine_id IS 'If set, card is restricted to this machine only.';
COMMENT ON COLUMN rfid_cards.product_id IS 'If set, overrides which product is charged/dispensed on tap.';
