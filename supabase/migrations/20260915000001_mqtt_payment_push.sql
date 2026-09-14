-- Marks which machines have been flashed with the new MQTT-push firmware
-- (USE_MQTT_PAYMENT_PUSH) instead of the original /api/payment_success
-- polling loop. Defaults to false so every existing machine keeps behaving
-- exactly as it does today -- this column is the only thing that decides
-- whether /api/razorpay/verify pushes over MQTT and marks the transaction
-- dispensed itself, or leaves it alone for the polling flow to handle as
-- it always has.
ALTER TABLE vending_machines
    ADD COLUMN IF NOT EXISTS mqtt_payment_push boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN vending_machines.mqtt_payment_push IS
    'true once this machine is running USE_MQTT_PAYMENT_PUSH firmware -- payment_success is pushed via MQTT instead of polled, and /api/razorpay/verify marks the transaction dispensed directly rather than waiting for a poll to claim it';
