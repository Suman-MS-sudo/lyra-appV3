-- Switch prepaid RFID cards from a money balance to a vend-count ("credits")
-- limit. Admins/customers now top up and cap cards by number of taps allowed,
-- not by rupees. Price is still resolved and logged per tap (rfid_payments
-- keeps amount_in_paisa for reporting/billing), it just no longer gates
-- whether a prepaid tap is allowed.

ALTER TABLE rfid_cards
    ADD COLUMN IF NOT EXISTS credits_remaining INTEGER NOT NULL DEFAULT 0 CHECK (credits_remaining >= 0);

-- Best-effort carry over existing money balances as a rough starting credit
-- count (₹1 = 1 credit) so cards topped up under the old model aren't left
-- at zero; admins can adjust afterward.
UPDATE rfid_cards
    SET credits_remaining = GREATEST(0, ROUND(balance_paisa / 100.0))
    WHERE card_type = 'prepaid';

ALTER TABLE rfid_cards DROP COLUMN IF EXISTS balance_paisa;

COMMENT ON COLUMN rfid_cards.credits_remaining IS 'Prepaid cards: number of taps/vends remaining, decremented by 1 per successful dispense regardless of product price.';

ALTER TABLE rfid_payments
    ADD COLUMN IF NOT EXISTS credits_after INTEGER CHECK (credits_after >= 0);

ALTER TABLE rfid_payments DROP COLUMN IF EXISTS balance_after_paisa;

COMMENT ON COLUMN rfid_payments.credits_after IS 'Prepaid: card credits_remaining after this tap. NULL for postpaid.';
