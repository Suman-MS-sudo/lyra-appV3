-- Add temperature column to vending_machines table
ALTER TABLE vending_machines 
ADD COLUMN IF NOT EXISTS temperature DECIMAL(5,2);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_vending_machines_temperature 
ON vending_machines(temperature);

-- Add comment
COMMENT ON COLUMN vending_machines.temperature IS 'ESP32 internal temperature in Celsius';
