-- Add stock column to vending_machines table
-- This stores the physical stock count synced from ESP32 EEPROM

ALTER TABLE vending_machines
ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;

-- Add index for stock queries
CREATE INDEX IF NOT EXISTS idx_vending_machines_stock ON vending_machines(stock);

-- Add comment
COMMENT ON COLUMN vending_machines.stock IS 'Physical stock count synced from ESP32 EEPROM';
