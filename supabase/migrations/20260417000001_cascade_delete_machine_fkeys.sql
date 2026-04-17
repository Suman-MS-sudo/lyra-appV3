-- Fix FK constraints on vending_machines to support deletion from the UI and API
-- Adds ON DELETE CASCADE so that deleting a machine automatically removes
-- its transactions and machine_products rows.

-- 1. transactions.machine_id -> vending_machines.id
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_machine_id_fkey;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_machine_id_fkey
  FOREIGN KEY (machine_id)
  REFERENCES vending_machines(id)
  ON DELETE CASCADE;

-- 2. machine_products.machine_id -> vending_machines.id (if constraint exists)
ALTER TABLE machine_products
  DROP CONSTRAINT IF EXISTS machine_products_machine_id_fkey;

ALTER TABLE machine_products
  ADD CONSTRAINT machine_products_machine_id_fkey
  FOREIGN KEY (machine_id)
  REFERENCES vending_machines(id)
  ON DELETE CASCADE;
