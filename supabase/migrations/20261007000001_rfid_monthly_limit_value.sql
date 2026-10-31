-- Replaces the on/off rfid_monthly_cap_enabled flag (see
-- 20260826000001_rfid_monthly_cap_per_org.sql) with an editable per-
-- organization limit, so each customer can have their own number (e.g. TVS
-- at 5, another customer at 6) instead of one hard-coded value for everyone
-- who opts in.
--
-- NULL = no monthly limit (the default). A positive number = that many RFID
-- taps per card per calendar month, counted across all of the
-- organization's machines combined (the counter lives on the card, see
-- 20260819000001_rfid_monthly_cap.sql).
--
-- Enforced in src/app/api/rfid-payment/route.ts (live taps) and mirrored
-- into the offline cache's per-card monthly_remaining in
-- src/app/api/machine-cards-sync/route.ts.

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS rfid_monthly_limit INTEGER
    CHECK (rfid_monthly_limit IS NULL OR rfid_monthly_limit > 0);

COMMENT ON COLUMN organizations.rfid_monthly_limit IS 'Max RFID taps per card per calendar month across all of this organization''s machines. NULL = unlimited.';

-- Carry over existing opt-ins at the previous hard-coded limit of 5.
UPDATE organizations
SET rfid_monthly_limit = 5
WHERE rfid_monthly_cap_enabled = true
  AND rfid_monthly_limit IS NULL;

ALTER TABLE organizations DROP COLUMN IF EXISTS rfid_monthly_cap_enabled;
