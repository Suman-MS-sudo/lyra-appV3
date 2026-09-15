-- Enterprise-grade additions to the OTA firmware system: archiving a build
-- stops it from being pushed to new machines without losing its history,
-- and tagging a build with the body type it's built for lets deploy-time
-- checks catch a single_motor build being pushed to a quad_motor machine
-- (or vice versa) before it bricks a machine's motor addressing.

ALTER TABLE firmware_versions
    ADD COLUMN IF NOT EXISTS archived_at timestamptz,
    ADD COLUMN IF NOT EXISTS compatible_body_type text
        CHECK (compatible_body_type IN ('single_motor', 'quad_motor'));
-- compatible_body_type NULL means "compatible with all body types" (the
-- default for existing/legacy uploads, which predate this distinction).

COMMENT ON COLUMN firmware_versions.archived_at IS 'When set, this version is hidden from the deploy picker but keeps its deployment history intact';
COMMENT ON COLUMN firmware_versions.compatible_body_type IS 'Which vending_machines.body_type this build targets; NULL = compatible with all';
