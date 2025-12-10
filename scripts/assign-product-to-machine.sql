-- Assign product to machine lyra_SNVM_003
-- Machine UUID: d1262fb0-7666-459f-838a-a6deafda7069
-- Product UUID: 3363667a-1551-4e89-9fc6-d26d526256ad (sanitary napkin XL)

INSERT INTO machine_products (machine_id, product_id, stock, price)
VALUES (
  'd1262fb0-7666-459f-838a-a6deafda7069',
  '3363667a-1551-4e89-9fc6-d26d526256ad',
  23,  -- Current stock from ESP32
  5.00  -- Price in rupees
)
ON CONFLICT (machine_id, product_id) 
DO UPDATE SET
  stock = EXCLUDED.stock,
  price = EXCLUDED.price,
  updated_at = NOW();

-- Verify the assignment
SELECT 
  m.name as machine_name,
  p.name as product_name,
  mp.stock,
  mp.price
FROM machine_products mp
JOIN vending_machines m ON m.id = mp.machine_id
JOIN products p ON p.id = mp.product_id
WHERE mp.machine_id = 'd1262fb0-7666-459f-838a-a6deafda7069';
