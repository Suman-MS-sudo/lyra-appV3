-- Extend vending_machines table with hardware and customer tracking fields

-- Add hardware-related columns
ALTER TABLE vending_machines
ADD COLUMN IF NOT EXISTS machine_id VARCHAR(50) UNIQUE, -- e.g., CN00005_SNVM_00022
ADD COLUMN IF NOT EXISTS mac_id VARCHAR(20), -- MAC address
ADD COLUMN IF NOT EXISTS machine_type VARCHAR(50), -- e.g., SNVM_WF_SL30
ADD COLUMN IF NOT EXISTS product_type VARCHAR(100), -- e.g., SANITARY PAD
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45), -- IPv4 or IPv6
ADD COLUMN IF NOT EXISTS device_secret TEXT; -- For authentication

-- Add customer/organization fields
ALTER TABLE vending_machines
ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50), -- e.g., CN00005
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255), -- e.g., L&T
ADD COLUMN IF NOT EXISTS customer_contact VARCHAR(50),
ADD COLUMN IF NOT EXISTS customer_alternate_contact VARCHAR(50),
ADD COLUMN IF NOT EXISTS customer_address TEXT,
ADD COLUMN IF NOT EXISTS customer_location VARCHAR(255);

-- Add inventory tracking
ALTER TABLE vending_machines
ADD COLUMN IF NOT EXISTS product_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS product_variety_count INTEGER DEFAULT 0;

-- Add status and monitoring fields
ALTER TABLE vending_machines
ADD COLUMN IF NOT EXISTS asset_online BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_ping TIMESTAMPTZ;

-- Add maintenance and warranty fields
ALTER TABLE vending_machines
ADD COLUMN IF NOT EXISTS purchase_date DATE,
ADD COLUMN IF NOT EXISTS warranty_till DATE,
ADD COLUMN IF NOT EXISTS amc_till DATE;

-- Add firmware tracking
ALTER TABLE vending_machines
ADD COLUMN IF NOT EXISTS firmware_version VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_firmware_update TIMESTAMPTZ;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vending_machines_machine_id ON vending_machines(machine_id);
CREATE INDEX IF NOT EXISTS idx_vending_machines_mac_id ON vending_machines(mac_id);
CREATE INDEX IF NOT EXISTS idx_vending_machines_customer_id ON vending_machines(customer_id);
CREATE INDEX IF NOT EXISTS idx_vending_machines_asset_online ON vending_machines(asset_online);
CREATE INDEX IF NOT EXISTS idx_vending_machines_last_ping ON vending_machines(last_ping);

-- Add comments for clarity
COMMENT ON COLUMN vending_machines.machine_id IS 'Hardware identifier from device (e.g., CN00005_SNVM_00022)';
COMMENT ON COLUMN vending_machines.mac_id IS 'MAC address of the vending machine hardware';
COMMENT ON COLUMN vending_machines.machine_type IS 'Hardware model type (e.g., SNVM_WF_SL30)';
COMMENT ON COLUMN vending_machines.product_type IS 'Type of products dispensed (e.g., SANITARY PAD)';
COMMENT ON COLUMN vending_machines.customer_id IS 'Customer/Organization identifier';
COMMENT ON COLUMN vending_machines.asset_online IS 'Current online/offline status from device';
COMMENT ON COLUMN vending_machines.last_ping IS 'Last communication timestamp from device';
COMMENT ON COLUMN vending_machines.device_secret IS 'Secret key for device authentication';
