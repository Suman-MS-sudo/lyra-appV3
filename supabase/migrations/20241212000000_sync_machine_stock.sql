-- Sync stock_level from vending_machines to machine_products
-- This trigger updates machine_products.stock when vending_machines.stock_level changes

CREATE OR REPLACE FUNCTION sync_machine_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all products for this machine to match the new stock_level
  UPDATE machine_products
  SET stock = NEW.stock_level,
      updated_at = NOW()
  WHERE machine_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires when stock_level changes
DROP TRIGGER IF EXISTS sync_stock_to_products ON vending_machines;

CREATE TRIGGER sync_stock_to_products
AFTER UPDATE OF stock_level ON vending_machines
FOR EACH ROW
WHEN (OLD.stock_level IS DISTINCT FROM NEW.stock_level)
EXECUTE FUNCTION sync_machine_stock();

-- Test: Update a machine's stock_level to verify sync
-- UPDATE vending_machines SET stock_level = 25 WHERE id = 'd1262fb0-7666-459f-838a-a6deafda7069';
-- SELECT stock FROM machine_products WHERE machine_id = 'd1262fb0-7666-459f-838a-a6deafda7069';
