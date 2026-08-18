-- Supports offline-captured RFID taps: machines running Ethernet-only can
-- now dispense product against a locally cached copy of card data while
-- disconnected, then push the resulting transactions to the server once
-- reconnected (see POST /api/rfid-payment/offline-sync). These two columns
-- let that reconciliation be replay-safe and auditable.

ALTER TABLE rfid_payments
    ADD COLUMN IF NOT EXISTS client_tx_id TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS offline BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN rfid_payments.client_tx_id IS 'Firmware-generated dedup key ("<deviceMAC>-<counter>") for offline-synced payments, so a retried sync batch never double-charges a card. Null for payments recorded live.';
COMMENT ON COLUMN rfid_payments.offline IS 'True if this payment was captured while the machine was offline and reconciled with the server afterward, rather than processed live.';
