-- Single-motor hopper capacity is actually 25 napkins, not 35 — correct the
-- column default and every existing single-motor machine's max_capacity.

ALTER TABLE vending_machines
    ALTER COLUMN max_capacity SET DEFAULT 25;

UPDATE vending_machines
SET max_capacity = 25
WHERE body_type = 'single_motor'
  AND max_capacity = 35;

-- Existing stock readings can't exceed the corrected capacity.
UPDATE vending_machines
SET stock_level = 25
WHERE body_type = 'single_motor'
  AND stock_level > 25;

COMMENT ON COLUMN vending_machines.body_type IS 'Physical dispenser body: single_motor (25 napkins) or quad_motor (100 napkins, 4x25)';
COMMENT ON COLUMN vending_machines.max_capacity IS 'Max stock capacity for this machine''s body type — 25 for single_motor, 100 for quad_motor';
