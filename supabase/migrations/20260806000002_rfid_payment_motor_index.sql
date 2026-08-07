-- Records which physical motor (0-indexed) served a given RFID tap on
-- quad-motor machines, so reports can show "M1"/"M2"/"M3"/"M4" per
-- transaction instead of just the aggregate stock number. Null for
-- single-motor machines and for any payment where the dispense step never
-- reported back which motor fired.

ALTER TABLE rfid_payments
    ADD COLUMN IF NOT EXISTS motor_index INTEGER;

COMMENT ON COLUMN rfid_payments.motor_index IS '0-indexed motor slot (0=M1 .. 3=M4) that dispensed this payment on quad-motor machines. Null for single-motor machines.';
