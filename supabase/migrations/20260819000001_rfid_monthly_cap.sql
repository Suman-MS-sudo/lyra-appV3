-- Every registered RFID card is capped at MONTHLY_VEND_LIMIT (5, see
-- src/lib/rfid-monthly-cap.ts) taps per calendar month, on top of whatever
-- credits_remaining/card_type already govern. Applies uniformly to prepaid
-- and postpaid cards, across all machines combined (not per-machine).
--
-- monthly_vend_month is the UTC 'YYYY-MM' the count applies to; a tap in a
-- new month resets the count instead of requiring a cron job. Enforced
-- server-side (rfid-payment route) and, since machines must keep honoring
-- this while offline, mirrored into the local card cache each machine
-- downloads (machine-cards-sync) and decrements itself (see the firmware's
-- handleOfflineRfidTap()).

ALTER TABLE rfid_cards
    ADD COLUMN IF NOT EXISTS monthly_vend_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS monthly_vend_month TEXT;

COMMENT ON COLUMN rfid_cards.monthly_vend_count IS 'Taps used within monthly_vend_month. Reset implicitly (not by a job) when a tap is seen in a new month.';
COMMENT ON COLUMN rfid_cards.monthly_vend_month IS 'UTC YYYY-MM that monthly_vend_count applies to. NULL means never tapped.';
