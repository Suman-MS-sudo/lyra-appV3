-- Remove vending_machine_id constraint from products if it exists
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_vending_machine_id_fkey;

-- Make vending_machine_id nullable (if it exists)
ALTER TABLE products 
ALTER COLUMN vending_machine_id DROP NOT NULL;

-- Create machine_products junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS machine_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES vending_machines(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  stock_quantity INTEGER DEFAULT 0,
  slot_number VARCHAR(10),
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(machine_id, product_id)
);

-- Add RLS policies for machine_products
ALTER TABLE machine_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all machine products" ON machine_products;
CREATE POLICY "Admins can manage all machine products"
ON machine_products FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.account_type = 'admin'
  )
);

DROP POLICY IF EXISTS "Super customers can view their organization's machine products" ON machine_products;
CREATE POLICY "Super customers can view their organization's machine products"
ON machine_products FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.account_type = 'super_customer'
  )
);

DROP POLICY IF EXISTS "Customers can view machine products" ON machine_products;
CREATE POLICY "Customers can view machine products"
ON machine_products FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.account_type = 'customer'
  )
);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_machine_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_machine_products_updated_at_trigger ON machine_products;
CREATE TRIGGER update_machine_products_updated_at_trigger
BEFORE UPDATE ON machine_products
FOR EACH ROW
EXECUTE FUNCTION update_machine_products_updated_at();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_machine_products_machine_id ON machine_products(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_products_product_id ON machine_products(product_id);
