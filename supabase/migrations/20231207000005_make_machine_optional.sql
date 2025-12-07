-- Make vending_machine_id optional in products table
-- Products should exist independently, machines map to products for pricing

ALTER TABLE products 
ALTER COLUMN vending_machine_id DROP NOT NULL;

-- Add comment to clarify the relationship
COMMENT ON COLUMN products.vending_machine_id IS 'Optional: Can be null for products not yet assigned to a machine. Machines should map to products for pricing.';
