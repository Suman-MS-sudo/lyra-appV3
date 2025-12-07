-- Update product price in machine_products table
-- This sets the price for sanitary napkin XL to ₹50

UPDATE machine_products
SET price = '50.00'
WHERE product_id = (
  SELECT id FROM products WHERE name = 'sanitary napkin XL'
)
AND machine_id = (
  SELECT id FROM vending_machines WHERE machine_id = 'lyra_SNVM_003'
);

-- Verify the update
SELECT 
  vm.machine_id,
  p.name as product_name,
  mp.price,
  mp.stock
FROM machine_products mp
JOIN vending_machines vm ON mp.machine_id = vm.id
JOIN products p ON mp.product_id = p.id
WHERE vm.machine_id = 'lyra_SNVM_003';
