-- Add machine health and diagnostic metrics to vending_machines table

ALTER TABLE vending_machines
ADD COLUMN IF NOT EXISTS wifi_rssi INTEGER, -- WiFi signal strength in dBm
ADD COLUMN IF NOT EXISTS free_heap INTEGER, -- Free memory in bytes
ADD COLUMN IF NOT EXISTS uptime BIGINT, -- Uptime in milliseconds
ADD COLUMN IF NOT EXISTS stock_level INTEGER, -- Current stock count
ADD COLUMN IF NOT EXISTS ip_address_current VARCHAR(45), -- Current IP address (dynamic)
ADD COLUMN IF NOT EXISTS connection_type VARCHAR(20), -- 'WiFi' or 'Ethernet'
ADD COLUMN IF NOT EXISTS last_error TEXT, -- Last error message
ADD COLUMN IF NOT EXISTS last_error_time TIMESTAMPTZ, -- When last error occurred
ADD COLUMN IF NOT EXISTS total_dispenses INTEGER DEFAULT 0, -- Total successful dispenses
ADD COLUMN IF NOT EXISTS failed_dispenses INTEGER DEFAULT 0; -- Failed dispense attempts

-- Create index for filtering by stock level
CREATE INDEX IF NOT EXISTS idx_vending_machines_stock_level ON vending_machines(stock_level);

-- Create index for filtering by online status
CREATE INDEX IF NOT EXISTS idx_vending_machines_asset_online ON vending_machines(asset_online);

COMMENT ON COLUMN vending_machines.wifi_rssi IS 'WiFi signal strength in dBm (typically -30 to -90)';
COMMENT ON COLUMN vending_machines.free_heap IS 'Free memory in bytes from ESP32';
COMMENT ON COLUMN vending_machines.uptime IS 'Device uptime in milliseconds';
COMMENT ON COLUMN vending_machines.stock_level IS 'Current stock count from ESP32 EEPROM';
COMMENT ON COLUMN vending_machines.connection_type IS 'Network connection type: WiFi or Ethernet';
