-- Add network speed column to vending_machines table
-- This tracks the network download speed in KB/s measured by ESP32

ALTER TABLE vending_machines
ADD COLUMN IF NOT EXISTS network_speed DECIMAL(10,2); -- Network speed in KB/s

-- Add index for queries
CREATE INDEX IF NOT EXISTS idx_vending_machines_network_speed ON vending_machines(network_speed);

-- Add comment
COMMENT ON COLUMN vending_machines.network_speed IS 'Network download speed in KB/s measured by ESP32';
