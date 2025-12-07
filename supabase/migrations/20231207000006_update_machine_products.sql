-- Update machine_products table to match hardware requirements
-- Add machine_id (string identifier), mac_id, and update column names

-- Drop existing unique constraint
ALTER TABLE machine_products 
DROP CONSTRAINT IF EXISTS machine_products_machine_id_product_id_key;

-- Add new columns
ALTER TABLE machine_products 
ADD COLUMN IF NOT EXISTS machine_id_string VARCHAR(50),
ADD COLUMN IF NOT EXISTS mac_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ DEFAULT NOW();

-- Rename columns to match expected structure
ALTER TABLE machine_products 
RENAME COLUMN stock_quantity TO stock;

-- Update is_available to is_active for consistency
ALTER TABLE machine_products 
RENAME COLUMN is_available TO is_active;

-- Convert is_active from boolean to integer (0/1) for hardware compatibility
-- First drop the default
ALTER TABLE machine_products 
ALTER COLUMN is_active DROP DEFAULT;

-- Then change the type
ALTER TABLE machine_products 
ALTER COLUMN is_active TYPE INTEGER USING (CASE WHEN is_active THEN 1 ELSE 0 END);

-- Set new default as integer
ALTER TABLE machine_products 
ALTER COLUMN is_active SET DEFAULT 1;

-- Update price column - add if doesn't exist, or modify existing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'machine_products' AND column_name = 'price'
  ) THEN
    ALTER TABLE machine_products ADD COLUMN price DECIMAL(10, 2);
  END IF;
END $$;

-- Create index on machine_id_string for faster lookups
CREATE INDEX IF NOT EXISTS idx_machine_products_machine_id_string ON machine_products(machine_id_string);
CREATE INDEX IF NOT EXISTS idx_machine_products_mac_id ON machine_products(mac_id);

-- Update the unique constraint to use machine_id_string instead of UUID
ALTER TABLE machine_products 
ADD CONSTRAINT machine_products_machine_string_product_unique 
UNIQUE(machine_id_string, product_id);

-- Add comment for clarity
COMMENT ON COLUMN machine_products.machine_id_string IS 'String identifier from hardware (e.g., CN00001_SNVM_00001)';
COMMENT ON COLUMN machine_products.mac_id IS 'MAC address of the vending machine hardware';
COMMENT ON COLUMN machine_products.added_at IS 'Timestamp when product was added to machine';
COMMENT ON COLUMN machine_products.is_active IS 'Active status as integer (0=inactive, 1=active) for hardware compatibility';
