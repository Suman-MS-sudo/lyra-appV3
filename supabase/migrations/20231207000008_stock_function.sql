-- Create function to decrement stock in machine_products table
CREATE OR REPLACE FUNCTION decrement_stock(
  p_machine_id UUID,
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE machine_products
  SET stock = stock - p_quantity
  WHERE machine_id = p_machine_id
    AND product_id = p_product_id
    AND stock >= p_quantity;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock or product not found';
  END IF;
END;
$$;
