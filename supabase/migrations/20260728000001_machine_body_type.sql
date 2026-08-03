-- Track physical body type per machine so the admin UI and stock displays
-- know the real capacity (35 for single-motor, 100 for quad-motor) instead
-- of assuming a fixed number.

ALTER TABLE vending_machines
    ADD COLUMN IF NOT EXISTS body_type TEXT NOT NULL DEFAULT 'single_motor'
        CHECK (body_type IN ('single_motor', 'quad_motor')),
    ADD COLUMN IF NOT EXISTS max_capacity INTEGER NOT NULL DEFAULT 35;

COMMENT ON COLUMN vending_machines.body_type IS 'Physical dispenser body: single_motor (35 napkins) or quad_motor (100 napkins, 4x25)';
COMMENT ON COLUMN vending_machines.max_capacity IS 'Max stock capacity for this machine''s body type — 35 for single_motor, 100 for quad_motor';
