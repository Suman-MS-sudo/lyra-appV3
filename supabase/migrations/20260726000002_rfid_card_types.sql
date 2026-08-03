-- Add support for two RFID card models:
--   'prepaid'  — existing behavior, balance_paisa is deducted per tap, capped at zero
--   'postpaid' — no balance check/deduction; every tap dispenses, and the machine
--                just tallies how many units were vended and what they'd cost, for
--                later billing (e.g. an office account settled monthly)

ALTER TABLE rfid_cards
    ADD COLUMN IF NOT EXISTS card_type TEXT NOT NULL DEFAULT 'prepaid'
        CHECK (card_type IN ('prepaid', 'postpaid')),
    ADD COLUMN IF NOT EXISTS vend_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_spent_paisa INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN rfid_cards.card_type IS 'prepaid: balance_paisa is deducted per tap. postpaid: unlimited taps, vend_count/total_spent_paisa accrue for later billing.';
COMMENT ON COLUMN rfid_cards.vend_count IS 'Postpaid cards: total number of successful taps/dispenses.';
COMMENT ON COLUMN rfid_cards.total_spent_paisa IS 'Postpaid cards: running total cost of everything vended, for billing.';
