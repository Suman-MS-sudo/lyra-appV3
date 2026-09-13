-- Enterprise OTA firmware update system: admin uploads a firmware build,
-- targets specific machines, and only those machines pull and apply it.
-- Delivery is a short-lived signed URL from a private Storage bucket, not a
-- public path -- device_secret (column already existed, unused) is used to
-- authenticate the device's status-report calls.

CREATE TABLE firmware_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version text NOT NULL UNIQUE,
    filename text NOT NULL,
    storage_path text NOT NULL,
    sha256 text NOT NULL,
    size_bytes integer NOT NULL,
    notes text,
    uploaded_by uuid REFERENCES profiles(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE firmware_deployments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firmware_version_id uuid NOT NULL REFERENCES firmware_versions(id),
    machine_id uuid NOT NULL REFERENCES vending_machines(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'downloading', 'applied', 'failed')),
    error_message text,
    requested_by uuid REFERENCES profiles(id),
    requested_at timestamptz NOT NULL DEFAULT now(),
    applied_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- A machine can only have one deployment in flight at a time; deploying
-- again to an already-pending machine should replace, not stack.
CREATE UNIQUE INDEX firmware_deployments_one_pending_per_machine
    ON firmware_deployments (machine_id)
    WHERE status = 'pending';

CREATE INDEX firmware_deployments_machine_id_idx ON firmware_deployments (machine_id);
CREATE INDEX firmware_deployments_firmware_version_id_idx ON firmware_deployments (firmware_version_id);

-- Every access to these tables goes through API routes using the service-role
-- client (createAdminClient), which bypasses RLS entirely -- no anon or
-- authenticated-user policy is needed or wanted here. Enable RLS with zero
-- policies so it defaults to deny-all for any non-service-role key, same
-- posture as the firmware Storage bucket below.
ALTER TABLE firmware_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE firmware_deployments ENABLE ROW LEVEL SECURITY;

-- device_secret already exists on vending_machines (added in
-- 20231207000007_extend_vending_machines.sql) but was never populated or
-- used. Backfill it now so every machine has a stable per-device secret the
-- firmware endpoints can authenticate against.
UPDATE vending_machines
SET device_secret = gen_random_uuid()::text
WHERE device_secret IS NULL;

ALTER TABLE vending_machines
    ALTER COLUMN device_secret SET DEFAULT gen_random_uuid()::text;

-- Private bucket -- firmware binaries are never served from a public URL,
-- only via short-lived signed URLs generated per machine-ping check-in.
INSERT INTO storage.buckets (id, name, public)
VALUES ('firmware', 'firmware', false)
ON CONFLICT (id) DO NOTHING;

-- Only the service role (used by all our API routes) may read/write firmware
-- binaries -- no anon/authenticated access, signed URLs bypass RLS by design.
CREATE POLICY "Service role manages firmware bucket"
ON storage.objects FOR ALL
USING (bucket_id = 'firmware' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'firmware' AND auth.role() = 'service_role');

COMMENT ON TABLE firmware_versions IS 'Uploaded ESP32 firmware builds available to deploy';
COMMENT ON TABLE firmware_deployments IS 'Per-machine OTA deployment requests and their status';
