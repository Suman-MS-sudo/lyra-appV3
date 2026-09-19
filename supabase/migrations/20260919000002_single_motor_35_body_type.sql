-- A 35-napkin single-motor variant exists in the field alongside the
-- 25-napkin single-motor and 100-napkin quad-motor bodies -- same one
-- dispenser/one stock counter firmware as single_motor, just a taller
-- hopper. Widening both CHECK constraints that currently only allow
-- ('single_motor', 'quad_motor') to also accept 'single_motor_35'.

ALTER TABLE vending_machines DROP CONSTRAINT IF EXISTS vending_machines_body_type_check;
ALTER TABLE vending_machines
    ADD CONSTRAINT vending_machines_body_type_check
    CHECK (body_type IN ('single_motor', 'single_motor_35', 'quad_motor'));

-- 20260915100000_firmware_ota_enterprise.sql (which adds this column) was
-- apparently never actually applied to this database -- ADD COLUMN IF NOT
-- EXISTS here so this migration is self-sufficient either way, instead of
-- assuming that earlier one already ran.
ALTER TABLE firmware_versions
    ADD COLUMN IF NOT EXISTS archived_at timestamptz,
    ADD COLUMN IF NOT EXISTS compatible_body_type text;
COMMENT ON COLUMN firmware_versions.archived_at IS 'When set, this version is hidden from the deploy picker but keeps its deployment history intact';

ALTER TABLE firmware_versions DROP CONSTRAINT IF EXISTS firmware_versions_compatible_body_type_check;
ALTER TABLE firmware_versions
    ADD CONSTRAINT firmware_versions_compatible_body_type_check
    CHECK (compatible_body_type IN ('single_motor', 'single_motor_35', 'quad_motor'));

COMMENT ON COLUMN vending_machines.body_type IS 'Physical dispenser body: single_motor (25 napkins), single_motor_35 (35 napkins, same firmware as single_motor), or quad_motor (100 napkins, 4x25)';
