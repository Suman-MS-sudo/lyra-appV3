-- Per-motor stock breakdown for quad-motor machines (M1..M4), so the admin
-- UI can show exact hopper levels on hover instead of just the combined
-- total. Null/absent for single-motor machines, which have only one hopper.

ALTER TABLE vending_machines
    ADD COLUMN IF NOT EXISTS motor_stock JSONB;

COMMENT ON COLUMN vending_machines.motor_stock IS 'Per-motor stock breakdown as a JSON array, e.g. [25,25,24,25] for a quad-motor machine. Null for single-motor machines.';
