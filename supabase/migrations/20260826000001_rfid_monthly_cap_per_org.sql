-- The RFID monthly tap cap (see 20260819000001_rfid_monthly_cap.sql) was
-- only ever meant for Lucas TVS, not every customer. Make it a per-
-- organization opt-in: cards whose organization has this flag set are
-- capped at MONTHLY_VEND_LIMIT (src/lib/rfid-monthly-cap.ts) taps per card
-- per calendar month; everyone else is uncapped. The per-card counter keeps
-- running for all cards either way.
--
-- Enforced in src/app/api/rfid-payment/route.ts (live taps) and mirrored
-- into the offline cache's per-card monthly_remaining in
-- src/app/api/machine-cards-sync/route.ts.

ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS rfid_monthly_cap_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN organizations.rfid_monthly_cap_enabled IS 'Cap each of this organization''s RFID cards at MONTHLY_VEND_LIMIT taps per calendar month.';

UPDATE organizations
SET rfid_monthly_cap_enabled = true
WHERE name ILIKE 'Lucas TVS%';
